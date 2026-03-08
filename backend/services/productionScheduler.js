const ProductionBatch = require("../models/productionBatchModel");
const StockLedger = require("../models/stockLedgerModel");
const { postProductionOutputEntry } = require("./accountingJournalService");

function computeShift(date) {
  const d = date instanceof Date ? date : new Date(date);
  const h = d.getHours();
  return h >= 6 && h < 18 ? "DAY" : "NIGHT";
}

/**
 * Completes due outputs and posts them to stock/journal.
 * Designed to be called on an interval; it is safe to run repeatedly.
 */
async function runOnce() {
  const now = new Date();

  // Find batches that have at least one due output.
  const batches = await ProductionBatch.find({
    status: "IN_PROCESS",
    outputs: {
      $elemMatch: {
        status: "IN_PROCESS",
        plannedCompleteAt: { $ne: null, $lte: now },
      },
    },
  });

  for (const batch of batches) {
    let changed = false;

    for (const out of batch.outputs || []) {
      if (!out) continue;
      if ((out.status || "COMPLETED") !== "IN_PROCESS") continue;
      if (!out.plannedCompleteAt) continue;
      if (new Date(out.plannedCompleteAt).getTime() > now.getTime()) continue;

      out.status = "COMPLETED";
      out.completedAt = now;
      out.shift = computeShift(now);
      changed = true;

      // Post stock entry
      try {
        await StockLedger.create({
          date: now,
          type: "IN",
          companyId: out.companyId || null,
          companyName: out.companyName || "",
          productTypeId: out.productTypeId,
          productTypeName: out.productTypeName,
          numBags: out.numBags || 0,
          netWeightKg: out.netWeightKg || 0,
          gatePassId: null,
          gatePassNo: "",
          remarks: `Production output (${out.shift}) - ${batch.batchNo}`,
        });
      } catch (e) {
        // keep going; we still mark completed to avoid duplicate completion loops
        console.error("productionScheduler StockLedger error:", e?.message || e);
      }

      // Post accounting journal entry
      try {
        await postProductionOutputEntry({
          batchId: batch._id,
          batchNo: batch.batchNo,
          outputDate: now,
          companyId: out.companyId || null,
          companyName: out.companyName || "",
          productTypeId: out.productTypeId,
          productTypeName: out.productTypeName,
          netWeightKg: out.netWeightKg || 0,
        });
      } catch (e) {
        console.error("productionScheduler journal error:", e?.message || e);
      }
    }

    if (changed) {
      // Auto-complete batch if all outputs are completed and at least one exists.
      const outputs = batch.outputs || [];
      const any = outputs.length > 0;
      const allDone = any && outputs.every((o) => (o.status || "COMPLETED") === "COMPLETED");
      if (allDone) {
        batch.status = "COMPLETED";
      }
      try {
        await batch.save();
      } catch (e) {
        console.error("productionScheduler save error:", e?.message || e);
      }
    }
  }
}

function start({ intervalMs = 30_000 } = {}) {
  // Avoid overlapping runs.
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runOnce();
    } catch (e) {
      console.error("productionScheduler runOnce error:", e?.message || e);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref?.();
  return timer;
}

module.exports = { start, runOnce };

