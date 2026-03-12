const Account = require("../models/accountModel");
const JournalEntry = require("../models/journalEntryModel");
const JournalLine = require("../models/journalLineModel");
const ProductType = require("../models/productTypeModel");

const DEFAULT_COA = [
  { code: "1100", name: "Cash", type: "ASSET", subType: "CASH", isControl: true },
  { code: "1110", name: "Bank", type: "ASSET", subType: "BANK", isControl: true },
  { code: "1200", name: "Accounts Receivable", type: "ASSET", subType: "AR", isControl: true },
  { code: "1300", name: "Raw Paddy Inventory", type: "ASSET", subType: "INVENTORY_RAW", isControl: true },
  { code: "1310", name: "Finished Goods Inventory", type: "ASSET", subType: "INVENTORY_FINISHED", isControl: true },
  { code: "2100", name: "Accounts Payable", type: "LIABILITY", subType: "AP", isControl: true },
  { code: "2200", name: "Payroll Payable", type: "LIABILITY", subType: "PAYROLL", isControl: true },
  { code: "3000", name: "Owner Equity", type: "EQUITY", subType: "EQUITY", isControl: true },
  { code: "4100", name: "Sales Revenue", type: "INCOME", subType: "SALES", isControl: true },
  { code: "5100", name: "Purchases Expense", type: "EXPENSE", subType: "PURCHASE", isControl: true },
  { code: "5200", name: "Operating Expense", type: "EXPENSE", subType: "OPERATING", isControl: true },
  { code: "5300", name: "Payroll Expense", type: "EXPENSE", subType: "PAYROLL", isControl: true },
  { code: "6100", name: "Cost of Goods Sold", type: "COGS", subType: "COGS", isControl: true },
];

const round2 = (n) => Number((Number(n || 0)).toFixed(2));

const nextVoucherNo = async () => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const prefix = `JV-${y}${m}${d}-`;
  const latest = await JournalEntry.findOne({ voucherNo: new RegExp(`^${prefix}`) })
    .sort({ voucherNo: -1 })
    .lean();
  let seq = 1;
  if (latest?.voucherNo) {
    const part = latest.voucherNo.split("-").pop();
    const parsed = Number(part);
    if (!Number.isNaN(parsed)) seq = parsed + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
};

const getPaymentAccountCode = (paymentMethod) => {
  const m = String(paymentMethod || "").toUpperCase();
  if (m === "CASH") return "1100";
  if (m === "CARD" || m === "ONLINE_TRANSFER" || m === "BANK_TRANSFER" || m === "ONLINE")
    return "1110";
  return "1100";
};

const ensureDefaultAccounts = async () => {
  for (const a of DEFAULT_COA) {
    // eslint-disable-next-line no-await-in-loop
    await Account.updateOne({ code: a.code }, { $setOnInsert: a }, { upsert: true });
  }
};

const getAccountsMap = async () => {
  const rows = await Account.find({ isActive: true }).lean();
  const map = new Map();
  rows.forEach((r) => map.set(r.code, r));
  return map;
};

const postJournalEntry = async ({
  date,
  sourceModule,
  sourceRefType,
  sourceRefId,
  narration,
  createdBy = "system",
  lines,
}) => {
  const normLines = (lines || [])
    .map((l) => ({
      ...l,
      debit: round2(l.debit),
      credit: round2(l.credit),
    }))
    .filter((l) => l.accountId && (l.debit > 0 || l.credit > 0));

  if (!normLines.length) return null;
  const totalDebit = round2(normLines.reduce((s, l) => s + (l.debit || 0), 0));
  const totalCredit = round2(normLines.reduce((s, l) => s + (l.credit || 0), 0));
  if (totalDebit <= 0 || totalDebit !== totalCredit) {
    throw new Error("Unbalanced journal entry.");
  }

  const voucherNo = await nextVoucherNo();
  const entry = await JournalEntry.create({
    voucherNo,
    date: date ? new Date(date) : new Date(),
    sourceModule: sourceModule || "",
    sourceRefType: sourceRefType || "",
    sourceRefId: String(sourceRefId || ""),
    narration: narration || "",
    createdBy,
    status: "POSTED",
  });

  await JournalLine.insertMany(
    normLines.map((l) => ({
      journalEntryId: entry._id,
      accountId: l.accountId,
      debit: l.debit,
      credit: l.credit,
      partyId: l.partyId || "",
      partyName: l.partyName || "",
      itemId: l.itemId || "",
      itemName: l.itemName || "",
      remarks: l.remarks || "",
    }))
  );

  return entry;
};

const reverseBySource = async ({ sourceModule, sourceRefType, sourceRefId, reason = "" }) => {
  const posted = await JournalEntry.find({
    sourceModule: sourceModule || "",
    sourceRefType: sourceRefType || "",
    sourceRefId: String(sourceRefId || ""),
    status: "POSTED",
  });
  for (const entry of posted) {
    // eslint-disable-next-line no-await-in-loop
    const lines = await JournalLine.find({ journalEntryId: entry._id }).lean();
    const reversal = await JournalEntry.create({
      voucherNo: await nextVoucherNo(),
      date: new Date(),
      sourceModule: entry.sourceModule,
      sourceRefType: entry.sourceRefType,
      sourceRefId: entry.sourceRefId,
      narration: `Reversal of ${entry.voucherNo}${reason ? `: ${reason}` : ""}`,
      createdBy: "system",
      status: "POSTED",
      reversalOf: entry._id,
    });
    // eslint-disable-next-line no-await-in-loop
    await JournalLine.insertMany(
      lines.map((l) => ({
        journalEntryId: reversal._id,
        accountId: l.accountId,
        debit: round2(l.credit),
        credit: round2(l.debit),
        partyId: l.partyId || "",
        partyName: l.partyName || "",
        itemId: l.itemId || "",
        itemName: l.itemName || "",
        remarks: `Reversal`,
      }))
    );
    entry.status = "REVERSED";
    // eslint-disable-next-line no-await-in-loop
    await entry.save();
  }
};

const estimateWeightedAverageCostPerKg = async (item) => {
  const id = item?.productTypeId;
  if (!id) return 0;
  const product = await ProductType.findById(id).lean().select("pricePerKg defaultSaleRate");
  return Number(product?.pricePerKg || 0) || Number(product?.defaultSaleRate || 0) || 0;
};

const buildTransactionLines = async (tx, accountsMap) => {
  const lines = [];
  const total = round2(tx.totalAmount || 0);
  const paid = round2(tx.partialPaid || 0);
  const remaining = round2(Math.max(total - paid, 0));
  const payAccountCode = getPaymentAccountCode(tx.paymentMethod);
  const payAccount = accountsMap.get(payAccountCode);
  const ar = accountsMap.get("1200");
  const ap = accountsMap.get("2100");
  const sales = accountsMap.get("4100");
  const purchases = accountsMap.get("5100");
  const rawInv = accountsMap.get("1300");
  const cogs = accountsMap.get("6100");
  const fgInv = accountsMap.get("1310");

  const partyId = tx.companyId ? String(tx.companyId) : "";
  const partyName = tx.companyName || "";

  if (tx.type === "SALE") {
    if (paid > 0 && payAccount) {
      lines.push({
        accountId: payAccount._id,
        debit: paid,
        credit: 0,
        partyId,
        partyName,
      });
    }
    if (remaining > 0 && ar) {
      lines.push({
        accountId: ar._id,
        debit: remaining,
        credit: 0,
        partyId,
        partyName,
      });
    }
    if (sales) {
      lines.push({
        accountId: sales._id,
        debit: 0,
        credit: total,
        partyId,
        partyName,
      });
    }

    let cogsTotal = 0;
    for (const item of tx.items || []) {
      if (!item.productTypeId || item.isManagerial) continue;
      // eslint-disable-next-line no-await-in-loop
      const avg = await estimateWeightedAverageCostPerKg(item);
      const qtyKg = Number(item.netWeightKg || 0);
      cogsTotal += round2(avg * qtyKg);
    }
    cogsTotal = round2(cogsTotal);
    if (cogsTotal > 0 && cogs && fgInv) {
      lines.push({ accountId: cogs._id, debit: cogsTotal, credit: 0, partyId, partyName });
      lines.push({ accountId: fgInv._id, debit: 0, credit: cogsTotal, partyId, partyName });
    }
  } else if (tx.type === "PURCHASE") {
    const isPaddy = tx.purchaseKind === "PADDY";
    const debitAccount = isPaddy ? rawInv : purchases;
    if (debitAccount) {
      lines.push({
        accountId: debitAccount._id,
        debit: total,
        credit: 0,
        partyId,
        partyName,
      });
    }
    if (paid > 0 && payAccount) {
      lines.push({
        accountId: payAccount._id,
        debit: 0,
        credit: paid,
        partyId,
        partyName,
      });
    }
    if (remaining > 0 && ap) {
      lines.push({
        accountId: ap._id,
        debit: 0,
        credit: remaining,
        partyId,
        partyName,
      });
    }
  }

  return lines;
};

const postTransactionEntry = async (tx) => {
  await ensureDefaultAccounts();
  const accountsMap = await getAccountsMap();
  const lines = await buildTransactionLines(tx, accountsMap);
  return postJournalEntry({
    date: tx.date,
    sourceModule: "TRANSACTION",
    sourceRefType: tx.type,
    sourceRefId: tx._id,
    narration: `${tx.type} ${tx.invoiceNo || ""}`.trim(),
    lines,
  });
};

const postExpenseEntry = async (expense) => {
  await ensureDefaultAccounts();
  const accountsMap = await getAccountsMap();
  const expAcc = accountsMap.get("5200");
  const payAcc = accountsMap.get(getPaymentAccountCode(expense.paymentMethod));
  if (!expAcc || !payAcc) return null;
  return postJournalEntry({
    date: expense.date,
    sourceModule: "EXPENSE",
    sourceRefType: "EXPENSE_ENTRY",
    sourceRefId: expense._id,
    narration: `Expense ${expense.categoryName || ""}`.trim(),
    lines: [
      { accountId: expAcc._id, debit: round2(expense.amount), credit: 0 },
      { accountId: payAcc._id, debit: 0, credit: round2(expense.amount) },
    ],
  });
};

const postProductionOutputEntry = async ({
  batchId,
  batchNo,
  outputDate,
  companyId,
  companyName,
  productTypeId,
  productTypeName,
  netWeightKg,
}) => {
  await ensureDefaultAccounts();
  const accountsMap = await getAccountsMap();
  const fg = accountsMap.get("1310");
  const raw = accountsMap.get("1300");
  if (!fg || !raw) return null;

  const costPerKg = await estimateWeightedAverageCostPerKg({
    productTypeId,
    productTypeName,
  });
  const amount = round2((Number(netWeightKg || 0) || 0) * costPerKg);
  if (amount <= 0) return null;

  return postJournalEntry({
    date: outputDate || new Date(),
    sourceModule: "PRODUCTION",
    sourceRefType: "OUTPUT",
    sourceRefId: `${batchId}:${productTypeId}:${new Date(outputDate || new Date()).getTime()}`,
    narration: `Production output ${batchNo || ""}`.trim(),
    lines: [
      {
        accountId: fg._id,
        debit: amount,
        credit: 0,
        partyId: companyId ? String(companyId) : "",
        partyName: companyName || "",
        itemId: productTypeId ? String(productTypeId) : "",
        itemName: productTypeName || "",
      },
      {
        accountId: raw._id,
        debit: 0,
        credit: amount,
        partyId: companyId ? String(companyId) : "",
        partyName: companyName || "",
        itemId: productTypeId ? String(productTypeId) : "",
        itemName: productTypeName || "",
      },
    ],
  });
};

module.exports = {
  ensureDefaultAccounts,
  getAccountsMap,
  postJournalEntry,
  reverseBySource,
  postTransactionEntry,
  postExpenseEntry,
  postProductionOutputEntry,
};

