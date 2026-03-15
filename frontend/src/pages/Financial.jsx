// src/pages/Financial.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CreditCard,
  ArrowDownCircle,
  ArrowUpCircle,
  Edit2,
  Plus,
  AlertCircle,
  Trash2,
  Save,
  Printer,
  Lock,
} from "lucide-react";
import api from "../services/api";
import Pin4Input from "../components/Pin4Input";
import AddOptionModal from "../components/ui/AddOptionModal";

const PAGE_SIZE = 10;

const DEFAULT_PURCHASE_CATEGORIES = ["General"];

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(baseISO, days) {
  const d = baseISO ? new Date(baseISO) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const emptyForm = {
  date: todayISO(),
  companyId: "",
  paymentStatus: "PAID", // default Paid
  paymentMethod: "CASH", // default Cash
  dueDate: "",
  partialPaid: "",
};

const makeEmptySaleItem = () => ({
  brand: "",
  productTypeId: "",
  numBags: "",
  perBagWeightKg: "",
  netWeightKg: "",
  rate: "",
  rateType: "per_bag",
});

const makeEmptyPurchaseItem = () => ({
  itemName: "",
  isCustom: false,
  isManagerial: true,
  isPaddy: false,
  quantity: "",
  netWeightKg: "",
  rate: "",
});
const OTHER_OPTION = "__OTHER__";
const MAX_AMOUNT_DIGITS = 8;
const clampAmountDigits = (value, maxDigits = MAX_AMOUNT_DIGITS) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, maxDigits);

const emptyQuickCustomer = {
  name: "",
  phone: "",
  email: "",
  address: "",
};

const QUICK_CUSTOMER_LIMITS = {
  name: 100,
  phone: 12,
  email: 100,
  address: 200,
};

const QUICK_CUSTOMER_PHONE_REGEX = /^03\d{2}-\d{7}$/;

function normalizeQuickCustomerInput(field, rawValue) {
  let value = String(rawValue ?? "");
  if (field === "name") {
    value = value.replace(/[^A-Za-z\s.'-]/g, "");
  } else if (field === "phone") {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 4) return digits;
    value = `${digits.slice(0, 4)}-${digits.slice(4)}`;
  } else if (field === "email") {
    value = value.replace(/\s/g, "");
  }
  const limit = QUICK_CUSTOMER_LIMITS[field];
  if (limit) value = value.slice(0, limit);
  return value;
}

function validateQuickCustomerField(field, rawValue) {
  const value = String(rawValue ?? "").trim();
  if (field === "name") {
    if (!value) return "Customer name is required";
    if (value.length < 2) return "Customer name must be at least 2 characters";
    return "";
  }
  if (field === "phone") {
    if (!value) return ""; // optional
    if (!QUICK_CUSTOMER_PHONE_REGEX.test(value)) {
      return "Phone format must be 03XX-XXXXXXX";
    }
    return "";
  }
  if (field === "email") {
    if (!value) return ""; // optional
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return validEmail ? "" : "Enter a valid email address";
  }
  if (field === "address") {
    if (!value) return ""; // optional
    if (value.length < 5) return "Address must be at least 5 characters";
    return "";
  }
  return "";
}

export default function Financial() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Tabs
  const [activeTab, setActiveTab] = useState("sale");

  // Masters
  const [customers, setCustomers] = useState([]);
  const [wholesellers, setWholesellers] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchaseItemOptions, setPurchaseItemOptions] = useState([]);
  const [purchaseCategoryOptions, setPurchaseCategoryOptions] = useState(DEFAULT_PURCHASE_CATEGORIES);

  // Stock balances: [{ companyId, companyName(brand), productTypeId, productTypeName, balanceKg }]
  const [stockBalances, setStockBalances] = useState([]);

  // PURCHASE state
  const [purchaseForm, setPurchaseForm] = useState({ ...emptyForm });
  const makeDefaultPurchaseItems = (kind) => {
    const base = { ...makeEmptyPurchaseItem(), isPaddy: kind === "PADDY" };
    if (kind === "PADDY") {
      return [base];
    }
    return Array.from({ length: 3 }, () => ({ ...makeEmptyPurchaseItem(), isPaddy: false }));
  };
  const [purchaseItems, setPurchaseItems] = useState(
    makeDefaultPurchaseItems("MANAGERIAL"),
  );
  const [formErrors, setFormErrors] = useState({
    sale: {},
    purchase: {},
    saleItems: [],
    purchaseItems: [],
  });
  const [purchaseKind, setPurchaseKind] = useState("MANAGERIAL");
  const [purchaseEditingId, setPurchaseEditingId] = useState(null);
  const [purchaseList, setPurchaseList] = useState([]);
  const [purchaseTotal, setPurchaseTotal] = useState(0);
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  // SALE state
  const [saleForm, setSaleForm] = useState({ ...emptyForm });
  const [saleItems, setSaleItems] = useState([makeEmptySaleItem()]);
  const [saleEditingId, setSaleEditingId] = useState(null);
  const [saleKind, setSaleKind] = useState("SMJ");
  const [saleCustomerMode, setSaleCustomerMode] = useState("EXISTING");
  const [saleCustomerListOpen, setSaleCustomerListOpen] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saleList, setSaleList] = useState([]);
  const [saleTotal, setSaleTotal] = useState(0);
  const [salePage, setSalePage] = useState(1);
  const [saleLoading, setSaleLoading] = useState(false);

  const [settings, setSettings] = useState({
    additionalStockSettingsEnabled: false,
    adminPin: "0000",
    companyName: "SMJ",
  });
  const [saleDateUnlocked, setSaleDateUnlocked] = useState(false);
  const [saleDatePinDialog, setSaleDatePinDialog] = useState({
    open: false,
    pin: "",
    pinError: "",
  });
  const [purchaseDateUnlocked, setPurchaseDateUnlocked] = useState(false);
  const [purchaseDatePinDialog, setPurchaseDatePinDialog] = useState({
    open: false,
    pin: "",
    pinError: "",
  });

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Print dialog
  const [printTxn, setPrintTxn] = useState(null);
  const [printSettings, setPrintSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [quickCustomerModal, setQuickCustomerModal] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ ...emptyQuickCustomer });
  const [quickCustomerErrors, setQuickCustomerErrors] = useState({});
  const [quickCustomerTouched, setQuickCustomerTouched] = useState({});
  const [quickCustomerSaving, setQuickCustomerSaving] = useState(false);

  // Print-only CSS for small invoice card
  const printStyles = `
    @media print {
      body * {
        visibility: hidden;
      }
      #print-invoice, #print-invoice * {
        visibility: visible;
      }
      #print-invoice {
        position: absolute;
        inset: 0;
        margin: auto;
        max-width: 80mm;
      }
    }
  `;

  // Load masters + stock
  const loadMasters = async () => {
    try {
      const [custRes, wholeRes, pRes] = await Promise.all([
        api.get("/customers"),
        api.get("/wholesellers"),
        api.get("/product-types"),
      ]);
      setCustomers(custRes.data?.data || []);
      setWholesellers(wholeRes.data?.data || []);
      setProducts(pRes.data?.data || []);
    } catch (err) {
      console.error("Error loading masters:", err);
    }
  };

  useEffect(() => {
    loadMasters();
    loadStockBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onFocus = () => loadMasters();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.get("/settings");
        if (res.data?.data) {
          const s = res.data.data;
          const companyName =
            s?.general?.companyName ||
            s?.generalSettings?.companyName ||
            "SMJ";
          setSettings({ ...s, companyName });
          if (Array.isArray(s.purchaseItemOptions)) {
            setPurchaseItemOptions(s.purchaseItemOptions);
          }
          if (Array.isArray(s.purchaseCategoryOptions)) {
            setPurchaseCategoryOptions(
              s.purchaseCategoryOptions.length
                ? s.purchaseCategoryOptions
                : DEFAULT_PURCHASE_CATEGORIES
            );
          }
        }
      } catch {}
    };
    loadSettings();
  }, []);

  

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "sale" || tab === "purchase") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Initial transactions
  useEffect(() => {
    fetchTransactions("PURCHASE", 1);
    fetchTransactions("SALE", 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load stock balances from backend
  const loadStockBalances = async () => {
    try {
      // our route: /api/stock/current
      const res = await api.get("/stock/current");
      setStockBalances(res.data.data || []);
    } catch (err) {
      console.error("Error loading stock balances:", err);
    }
  };

  const fetchTransactions = async (type, page = 1) => {
    const skip = (page - 1) * PAGE_SIZE;
    if (type === "PURCHASE") setPurchaseLoading(true);
    if (type === "SALE") setSaleLoading(true);
    try {
      const res = await api.get("/transactions", {
        params: { type, limit: PAGE_SIZE, skip },
      });
      const { data = [], total = 0 } = res.data || {};
      if (type === "PURCHASE") {
        setPurchaseList(data);
        setPurchaseTotal(total);
        setPurchasePage(page);
      } else {
        setSaleList(data);
        setSaleTotal(total);
        setSalePage(page);
      }
    } catch (err) {
      console.error("Error loading transactions:", err);
    } finally {
      if (type === "PURCHASE") setPurchaseLoading(false);
      if (type === "SALE") setSaleLoading(false);
    }
  };

  const totalPagesFor = (total) =>
    Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));

  const closeQuickCustomerModal = () => {
    setQuickCustomerModal(false);
    setQuickCustomer({ ...emptyQuickCustomer });
    setQuickCustomerErrors({});
    setQuickCustomerTouched({});
  };

  const handleQuickCustomerChange = (field, value) => {
    const normalized = normalizeQuickCustomerInput(field, value);
    setQuickCustomer((prev) => ({ ...prev, [field]: normalized }));
    setQuickCustomerTouched((prev) => ({ ...prev, [field]: true }));
    const nextError = validateQuickCustomerField(field, normalized);
    setQuickCustomerErrors((prev) => ({ ...prev, [field]: nextError }));
  };

  const saveQuickCustomer = async () => {
    const payload = {
      name: String(quickCustomer.name || "").trim(),
      phone: String(quickCustomer.phone || "").trim(),
      email: String(quickCustomer.email || "").trim().toLowerCase(),
      address: String(quickCustomer.address || "").trim(),
    };
    const touchedAll = {
      name: true,
      phone: true,
      email: true,
      address: true,
    };
    const validationErrors = Object.keys(touchedAll).reduce((acc, field) => {
      const msg = validateQuickCustomerField(field, payload[field]);
      if (msg) acc[field] = msg;
      return acc;
    }, {});
    setQuickCustomerTouched(touchedAll);
    setQuickCustomerErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }
    setQuickCustomerSaving(true);
    try {
      const res = await api.post("/customers", payload);
      const created = res.data?.data;
      // refresh masters so dropdowns include it
      await loadMasters();
      if (created?._id) {
        setSaleForm((prev) => ({ ...prev, companyId: created._id }));
      }
      closeQuickCustomerModal();
      return created;
    } catch (err) {
      setSaveError(err?.response?.data?.message || "Failed to add customer");
      return null;
    } finally {
      setQuickCustomerSaving(false);
    }
  };

  const ensureSaleCompany = async () => {
    const payload = {
      name: String(quickCustomer.name || "").trim(),
      phone: String(quickCustomer.phone || "").trim(),
      email: String(quickCustomer.email || "").trim().toLowerCase(),
      address: String(quickCustomer.address || "").trim(),
    };
    const touchedAll = {
      name: true,
      phone: true,
      email: true,
      address: true,
    };
    const validationErrors = Object.keys(touchedAll).reduce((acc, field) => {
      const msg = validateQuickCustomerField(field, payload[field]);
      if (msg) acc[field] = msg;
      return acc;
    }, {});
    setQuickCustomerTouched(touchedAll);
    setQuickCustomerErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return null;
    }
    const list = saleKind === "SMJ" ? wholesellers : customers;
    const match = list.find((c) => {
      const nameMatch = String(c.name || "").trim().toLowerCase() === payload.name.toLowerCase();
      const emailMatch = payload.email && String(c.email || "").trim().toLowerCase() === payload.email;
      const phoneMatch = payload.phone && String(c.phone || "").trim() === payload.phone;
      return nameMatch || emailMatch || phoneMatch;
    });
    if (match?._id) {
      setSaleForm((prev) => ({ ...prev, companyId: match._id }));
      return match;
    }
    // Persist into the correct table based on saleKind
    if (saleKind === "SMJ") {
      try {
        const res = await api.post("/wholesellers", payload);
        const created = res.data?.data;
        await loadMasters();
        if (created?._id) setSaleForm((prev) => ({ ...prev, companyId: created._id }));
        closeQuickCustomerModal();
        return created;
      } catch (err) {
        setSaveError(err?.response?.data?.message || "Failed to add wholeseller");
        return null;
      }
    }
    return saveQuickCustomer();
  };

  // Helpers
  const handleFormChange = (type, field, value) => {
    if (type === "SALE" && field === "companyId") {
      if (value === OTHER_OPTION) {
        setSaleCustomerMode("NEW");
        setSaleForm((f) => ({ ...f, companyId: "" }));
        setQuickCustomer({ ...emptyQuickCustomer });
        setQuickCustomerErrors({});
        setQuickCustomerTouched({});
        return;
      }
      setSaleCustomerMode("EXISTING");
      setSaleForm((f) => ({ ...f, companyId: value }));
      const match = (saleKind === "SMJ" ? wholesellers : customers).find(
        (c) => String(c._id) === String(value)
      );
      if (match) {
        setQuickCustomer({
          name: match.name || "",
          phone: match.phone || "",
          email: match.email || "",
          address: match.address || "",
        });
      }
      setFormErrors((prev) => ({
        ...prev,
        sale: { ...prev.sale, companyId: "" },
      }));
      return;
    }
    const errorKey = type === "PURCHASE" ? "purchase" : "sale";
    setFormErrors((prev) => ({
      ...prev,
      [errorKey]: { ...prev[errorKey], [field]: "" },
    }));
    if (type === "PURCHASE") {
      setPurchaseForm((f) => {
        if (field === "paymentStatus") {
          const shouldSetDue =
            (value === "UNPAID" || value === "PARTIAL") && !f.dueDate;
          return {
            ...f,
            paymentStatus: value,
            dueDate: shouldSetDue ? addDaysISO(f.date, 7) : f.dueDate,
          };
        }
        return { ...f, [field]: value };
      });
    } else {
      setSaleForm((f) => {
        if (field === "paymentStatus") {
          const shouldSetDue =
            (value === "UNPAID" || value === "PARTIAL") && !f.dueDate;
          return {
            ...f,
            paymentStatus: value,
            dueDate: shouldSetDue ? addDaysISO(f.date, 7) : f.dueDate,
          };
        }
        return { ...f, [field]: value };
      });
    }
  };

  const handleItemChange = (type, index, field, value) => {
    const list = type === "PURCHASE" ? [...purchaseItems] : [...saleItems];
    const item = { ...list[index], [field]: value };
    const errorKey = type === "PURCHASE" ? "purchaseItems" : "saleItems";
    setFormErrors((prev) => {
      const nextItems = [...(prev[errorKey] || [])];
      if (nextItems[index]) {
        nextItems[index] = { ...nextItems[index], [field]: "" };
      }
      return { ...prev, [errorKey]: nextItems };
    });

    if (type === "PURCHASE") {
      if (purchaseKind === "PADDY") {
        item.isPaddy = true;
        if (field === "netWeightKg") {
          const digits = String(value || "")
            .replace(/\D/g, "")
            .slice(0, 6);
          item.netWeightKg = digits;
        }
        if (field === "rate") {
          const digits = clampAmountDigits(value);
          item.rate = digits;
        }
        list[index] = item;
        setPurchaseItems(list);
        return;
      }
      if (field === "itemSelect") {
        if (value === OTHER_OPTION) {
          item.isCustom = true;
          item.itemName = "";
        } else {
          item.isCustom = false;
          item.itemName = value;
        }
      }
      if (field === "itemName") {
        item.itemName = value;
        item.isCustom = true;
      }

      if (field === "quantity") {
        const digits = String(value || "")
          .replace(/\D/g, "")
          .slice(0, 5);
        item.quantity = digits;
      }

      if (field === "rate") {
        const digits = clampAmountDigits(value);
        item.rate = digits;
      }

      list[index] = item;
      setPurchaseItems(list);
      return;
    }

    if (field === "numBags") {
      const digits = String(value || "")
        .replace(/\D/g, "")
        .slice(0, 5);
      item.numBags = digits;
      value = digits;
    }

    const product =
      item.productTypeId &&
      products.find((p) => String(p._id) === String(item.productTypeId));
    const factors = product?.conversionFactors || {};
    const tonKg = Number(factors.Ton || 1000) || 1000;
    const bagKg = Number(factors.Bag || 65) || 0;

    const unitWeightForRate = (rateType) => {
      if (rateType === "per_kg") return 1;
      if (rateType === "per_ton") return tonKg;
      return bagKg;
    };

    const rateForRateType = (rateType) => {
      if (!product) return "";
      if (rateType === "per_bag" && product.pricePerBag != null) {
        return String(product.pricePerBag);
      }
      if (rateType === "per_ton" && product.pricePerTon != null) {
        return String(product.pricePerTon);
      }
      if (rateType === "per_kg" && product.pricePerKg != null) {
        return String(product.pricePerKg);
      }
      return item.rate || "";
    };

    if (field === "brand" && type === "SALE") {
      item.productTypeId = "";
      item.perBagWeightKg = "";
      item.netWeightKg = "";
    }

    if (field === "productTypeId" && value) {
      const selected = products.find((p) => String(p._id) === String(value));
      if (selected && type === "SALE" && selected.brand) {
        item.brand = selected.brand;
      }

      const units = Array.isArray(selected?.allowableSaleUnits)
        ? selected.allowableSaleUnits
        : [];
      const preferredUnit = units.includes("Bag")
        ? "Bag"
        : units.includes("Ton")
          ? "Ton"
          : "KG";
      const nextRateType =
        preferredUnit === "Bag"
          ? "per_bag"
          : preferredUnit === "Ton"
            ? "per_ton"
            : "per_kg";

      item.rateType = nextRateType;
      const unitKg = unitWeightForRate(nextRateType);
      item.perBagWeightKg = unitKg ? String(unitKg) : "";
      item.rate = rateForRateType(nextRateType);

      const qty = Number(item.numBags || 0);
      if (qty) {
        if (nextRateType === "per_kg") {
          item.netWeightKg = String(Math.round(qty));
        } else if (unitKg) {
          item.netWeightKg = String(Math.round(qty * unitKg));
        } else {
          item.netWeightKg = "";
        }
      } else {
        item.netWeightKg = "";
      }
    }

    if (field === "rateType") {
      const unitKg = unitWeightForRate(value);
      if (unitKg) {
        item.perBagWeightKg = String(unitKg);
      }
      item.rate = rateForRateType(value);
      const qty = Number(item.numBags || 0);
      if (qty) {
        if (value === "per_kg") {
          item.netWeightKg = String(Math.round(qty));
        } else if (unitKg) {
          item.netWeightKg = String(Math.round(qty * unitKg));
        } else {
          item.netWeightKg = "";
        }
      } else {
        item.netWeightKg = "";
      }
    }

    if (field === "numBags" || field === "perBagWeightKg") {
      const qty = Number(field === "numBags" ? value : item.numBags || 0) || 0;
      const unitKg =
        Number(field === "perBagWeightKg" ? value : item.perBagWeightKg || 0) ||
        0;
      if (!qty) {
        item.netWeightKg = "";
      } else if (item.rateType === "per_kg") {
        item.netWeightKg = String(Math.round(qty));
      } else if (unitKg) {
        item.netWeightKg = String(Math.round(qty * unitKg));
      } else {
        item.netWeightKg = "";
      }
    }

    list[index] = item;
    if (type === "PURCHASE") setPurchaseItems(list);
    else setSaleItems(list);
  };

  const addItemRow = (type) => {
    if (type === "PURCHASE")
      setPurchaseItems((items) => [
        ...items,
        { ...makeEmptyPurchaseItem(), isPaddy: purchaseKind === "PADDY" },
      ]);
    else setSaleItems((items) => [...items, makeEmptySaleItem()]);
  };

  const computeLineAmount = (item) => {
    const rate = Number(item.rate || 0);
    if (!rate) return 0;

    if (item.isPaddy) {
      const net = Number(item.netWeightKg || 0);
      if (!net) return 0;
      return net * rate;
    }

    if (item.itemName || item.isManagerial) {
      const qty = Number(item.quantity || 0);
      return qty * rate;
    }

    const qty = Number(item.numBags || 0);
    if (!qty) return 0;
    if (item.rateType === "per_kg") return qty * rate;
    return qty * rate;
  };

  const computeNetWeightKg = (item) => {
    const qty = Number(item.numBags || 0);
    const unitKg = Number(item.perBagWeightKg || 0);
    if (!qty) return 0;
    if (item.rateType === "per_kg") return qty;
    if (!unitKg) return 0;
    return qty * unitKg;
  };

const computeInvoiceTotal = (items) =>
  items.reduce((sum, it) => sum + computeLineAmount(it), 0);

const computePaidRemaining = (form, total) => {
  const roundedTotal = Math.round(total);
  if (form.paymentStatus === "PAID") {
    return { paid: roundedTotal, remaining: 0 };
  }
  if (form.paymentStatus === "UNPAID") {
    return { paid: 0, remaining: roundedTotal };
  }
  const paid = Number(form.partialPaid || 0);
  const remaining = Math.max(total - paid, 0);
  return { paid, remaining };
};

  // Stock helper
  const getStockBalance = (productTypeId) => {
    if (!productTypeId) return null;
    const targetId = String(productTypeId);
    const row = stockBalances.find(
      (b) => String(b.productTypeId || "") === targetId,
    );
    if (!row) return null;
    return Number(row.balanceKg || 0);
  };

  const validateForm = (type) => {
    const form = type === "PURCHASE" ? purchaseForm : saleForm;
    const items = type === "PURCHASE" ? purchaseItems : saleItems;
    const nextErrors = {
      sale: {},
      purchase: {},
      saleItems: [],
      purchaseItems: [],
    };
    const formKey = type === "PURCHASE" ? "purchase" : "sale";
    const itemKey = type === "PURCHASE" ? "purchaseItems" : "saleItems";
    let isValid = true;

    if (!form.date) {
      nextErrors[formKey].date = "Date is required";
      isValid = false;
    }
    if (type === "SALE" && saleCustomerMode !== "NEW" && !form.companyId) {
      nextErrors[formKey].companyId = `Please select a ${saleKind === "SMJ" ? "wholeseller" : "customer"}`;
      isValid = false;
    }
    if (type === "SALE" && saleCustomerMode === "NEW") {
      if (!String(quickCustomer.name || "").trim()) {
        nextErrors[formKey].companyId = `Enter ${saleKind === "SMJ" ? "wholeseller" : "customer"} name`;
        // Also show inline error under the name field (user expects line error, not silent).
        setQuickCustomerErrors((prev) => ({
          ...prev,
          name: `${saleKind === "SMJ" ? "Wholeseller" : "Customer"} name is required`,
        }));
        setQuickCustomerTouched((prev) => ({ ...prev, name: true }));
        isValid = false;
      }
    }

    if (type === "SALE" && saleKind === "CUSTOM") {
      items.forEach((it, idx) => {
        if (!it.brand) {
          nextErrors[itemKey][idx] = {
            ...(nextErrors[itemKey][idx] || {}),
            brand: "Brand is required",
          };
          isValid = false;
        }
      });
    }

    const total = computeInvoiceTotal(items);
    const payStatus = form.paymentStatus || "PAID";

    if ((payStatus === "UNPAID" || payStatus === "PARTIAL") && !form.dueDate) {
      nextErrors[formKey].dueDate =
        "Due date is required for unpaid or partial invoices";
      isValid = false;
    }

    if (payStatus === "PARTIAL") {
      const paid = Number(form.partialPaid || 0);
      if (!paid || paid <= 0) {
        nextErrors[formKey].partialPaid =
          "For partial payment, amount paid must be > 0";
        isValid = false;
      }
      if (paid > total) {
        nextErrors[formKey].partialPaid =
          "Amount paid cannot exceed total invoice amount";
        isValid = false;
      }
    }

    const isRowEmpty = (row) => {
      if (type === "PURCHASE") {
        if (purchaseKind === "PADDY") {
          return !row.netWeightKg && !row.rate;
        }
        return !row.itemName && !row.quantity && !row.rate;
      }
      if (saleKind === "CUSTOM") {
        return (
          !row.brand &&
          !row.productTypeId &&
          !row.numBags &&
          !row.perBagWeightKg &&
          !row.rate
        );
      }
      return (
        !row.productTypeId &&
        !row.numBags &&
        !row.perBagWeightKg &&
        !row.rate
      );
    };

    const nonEmptyItems = Array.isArray(items)
      ? items.filter((row) => !isRowEmpty(row))
      : [];

    if (!Array.isArray(items) || nonEmptyItems.length === 0) {
      nextErrors[formKey].items = "Add at least one item";
      isValid = false;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (isRowEmpty(it)) {
        continue;
      }
      if (type === "PURCHASE") {
        if (purchaseKind === "PADDY") {
          const net = Number(it.netWeightKg || 0);
          if (!net || net <= 0) {
            nextErrors[itemKey][i] = {
              ...(nextErrors[itemKey][i] || {}),
              netWeightKg: "Paddy weight must be > 0",
            };
            isValid = false;
          }
          const rate = Number(it.rate || 0);
          if (!rate || rate <= 0) {
            nextErrors[itemKey][i] = {
              ...(nextErrors[itemKey][i] || {}),
              rate: "Rate must be greater than 0",
            };
            isValid = false;
          }
          continue;
        }
        if (!it.itemName || !it.itemName.trim()) {
          nextErrors[itemKey][i] = {
            ...(nextErrors[itemKey][i] || {}),
            itemName: "Select or enter an item name",
          };
          isValid = false;
        }
        const qty = Number(it.quantity || 0);
        if (!qty || qty <= 0) {
          nextErrors[itemKey][i] = {
            ...(nextErrors[itemKey][i] || {}),
            quantity: "Quantity must be greater than 0",
          };
          isValid = false;
        }
        const rate = Number(it.rate || 0);
        if (!rate || rate <= 0) {
          nextErrors[itemKey][i] = {
            ...(nextErrors[itemKey][i] || {}),
            rate: "Rate must be greater than 0",
          };
          isValid = false;
        }
        continue;
      }

      if (!it.productTypeId) {
        nextErrors[itemKey][i] = {
          ...(nextErrors[itemKey][i] || {}),
          productTypeId: "Select a product",
        };
        isValid = false;
      }
      const rate = Number(it.rate || 0);
      if (!rate || rate <= 0) {
        nextErrors[itemKey][i] = {
          ...(nextErrors[itemKey][i] || {}),
          rate: "Rate must be greater than 0",
        };
        isValid = false;
      }
      const net = computeNetWeightKg(it);
      if (!net || net <= 0) {
        nextErrors[itemKey][i] = {
          ...(nextErrors[itemKey][i] || {}),
          netWeightKg: "Net weight must be > 0",
        };
        isValid = false;
      }
    }

    // Extra validation for SALE: cannot sell more than stock
    if (type === "SALE" && stockBalances.length) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const net = computeNetWeightKg(it);
        const bal = getStockBalance(it.productTypeId);
        if (bal != null && net > bal + 0.0001) {
          nextErrors[itemKey][i] = {
            ...(nextErrors[itemKey][i] || {}),
            netWeightKg: `Net weight (${Math.round(
              net,
            )} kg) exceeds available stock (${Math.round(bal)} kg)`,
          };
          isValid = false;
        }
      }
    }

    setFormErrors(nextErrors);
    return isValid;
  };

  const buildPayload = (type) => {
    const form = type === "PURCHASE" ? purchaseForm : saleForm;
    const items = type === "PURCHASE" ? purchaseItems : saleItems;
    const total = computeInvoiceTotal(items);

    const isRowEmpty = (row) => {
      if (type === "PURCHASE") {
        if (purchaseKind === "PADDY") {
          return !row.netWeightKg && !row.rate;
        }
        return !row.itemName && !row.quantity && !row.rate;
      }
      return (
        !row.brand &&
        !row.productTypeId &&
        !row.numBags &&
        !row.perBagWeightKg &&
        !row.rate
      );
    };

    const mappedItems = items.filter((it) => !isRowEmpty(it)).map((it) => {
      if (type === "PURCHASE") {
        if (purchaseKind === "PADDY") {
          return {
            isPaddy: true,
            itemName: "",
            isManagerial: false,
            netWeightKg: Number(it.netWeightKg || 0),
            rate: Number(it.rate || 0),
            rateType: "per_kg",
          };
        }
        return {
          itemName: it.itemName || "",
          category: "",
          condition: "",
          unit: "Nos",
          quantity: Number(it.quantity || 0),
          rate: Number(it.rate || 0),
          rateType: "per_unit",
          isManagerial: true,
        };
      }

      const qty = Number(it.numBags || 0);
      const perUnit = Number(it.perBagWeightKg || 0);
      const net = computeNetWeightKg(it);

      return {
        productTypeId: it.productTypeId,
        numBags: qty,
        perBagWeightKg: perUnit,
        netWeightKg: net,
        rate: Number(it.rate || 0),
        rateType: it.rateType || "per_kg",
        ...(saleKind === "CUSTOM" ? { brand: it.brand } : {}),
      };
    });

    return {
      type: type === "PURCHASE" ? "PURCHASE" : "SALE",
      date: form.date,
      companyId: form.companyId,
      paymentStatus: form.paymentStatus || "PAID",
      paymentMethod: form.paymentMethod || "CASH",
      dueDate: form.paymentStatus === "PAID" ? null : form.dueDate || null,
      remarks: "",
      purchaseKind: type === "PURCHASE" ? purchaseKind : undefined,
      saleKind: type === "SALE" ? saleKind : undefined,
      items: mappedItems,
      partialPaid: computePaidRemaining(form, total).paid,
    };
  };

  const resetForm = (type) => {
    if (type === "PURCHASE") {
      setPurchaseForm({ ...emptyForm });
      setPurchaseItems([makeEmptyPurchaseItem()]);
      setPurchaseKind("MANAGERIAL");
      setPurchaseEditingId(null);
    } else {
      setSaleForm({ ...emptyForm });
      setSaleItems([makeEmptySaleItem()]);
      setSaleKind("SMJ");
      setSaleEditingId(null);
      setSaleCustomerMode("NEW");
      setQuickCustomer({ ...emptyQuickCustomer });
      setQuickCustomerErrors({});
      setQuickCustomerTouched({});
    }
  };

  const handleSubmit = async (type, e) => {
    e.preventDefault();
    setSaveError("");
    let resolvedSaleCompanyId = "";
    if (type === "SALE" && saleCustomerMode === "NEW") {
      const created = await ensureSaleCompany();
      if (!created) return;
      resolvedSaleCompanyId = String(created._id || "");
      // Keep UI state updated, but rely on resolvedSaleCompanyId for this submit.
      if (resolvedSaleCompanyId) {
        setSaleForm((prev) => ({ ...prev, companyId: resolvedSaleCompanyId }));
        setSaleCustomerMode("EXISTING");
      }
    }
    if (type === "SALE" && !saleForm.companyId && saleCustomerMode !== "NEW") {
      setSaveError(`Please select a ${saleKind === "SMJ" ? "wholeseller" : "customer"}.`);
      validateForm(type);
      return;
    }
    if (!validateForm(type)) {
      setSaveError("Please fill all required fields highlighted in red.");
      return;
    }

    const payload = buildPayload(type);
    if (type === "SALE") {
      // Ensure backend always receives a company reference.
      if (resolvedSaleCompanyId) payload.companyId = resolvedSaleCompanyId;
      if (!payload.companyId) payload.companyName = String(quickCustomer.name || "").trim();
    }
    const isEditing =
      type === "PURCHASE" ? !!purchaseEditingId : !!saleEditingId;
    const editingId = type === "PURCHASE" ? purchaseEditingId : saleEditingId;

    try {
      if (isEditing) {
        await api.put(`/transactions/${editingId}`, payload);
        setSaveError("");
      } else {
        await api.post("/transactions", payload);
        setSaveError("");
      }
      resetForm(type);
      fetchTransactions(type, 1);
      // reload stock after any transaction
      loadStockBalances();
      if (type === "PURCHASE") {
        const names = (payload.items || [])
          .map((it) => (it.itemName || "").trim())
          .filter(Boolean);
        const nextItems = Array.from(
          new Set([...purchaseItemOptions, ...names])
        );
        if (
          nextItems.length !== purchaseItemOptions.length
        ) {
          try {
            await api.put("/settings", {
              purchaseItemOptions: nextItems,
            });
            setPurchaseItemOptions(nextItems);
            } catch (e) {
              setSaveError("Failed to update purchase dropdowns");
            }
        }
      }
    } catch (err) {
      console.error("Save transaction error:", err?.response?.data || err);
      const msg = err?.response?.data?.message || "Failed to save transaction";
      setSaveError(msg);
    }
  };

  const handleEdit = (type, txn) => {
    setActiveTab(type === "PURCHASE" ? "purchase" : "sale");

    const form = {
      date: txn.date
        ? new Date(txn.date).toISOString().slice(0, 10)
        : todayISO(),
      companyId: txn.partyRefId || txn.companyId || "",
      paymentStatus: txn.paymentStatus || "PAID",
      paymentMethod: txn.paymentMethod || "CASH",
      dueDate: txn.dueDate
        ? new Date(txn.dueDate).toISOString().slice(0, 10)
        : "",
      partialPaid: txn.partialPaid != null ? String(txn.partialPaid) : "",
    };

      const items = (txn.items || []).map((it) => {
        if (type === "PURCHASE" && txn.purchaseKind === "PADDY") {
        return {
          isPaddy: true,
          netWeightKg: it.netWeightKg != null ? String(it.netWeightKg) : "",
          rate: it.rate != null ? String(it.rate) : "",
        };
      }
      if (type === "PURCHASE" && (it.isManagerial || it.itemName)) {
        const inList = purchaseItemOptions.includes(it.itemName || "");
        return {
          itemName: it.itemName || "",
          isCustom: !inList,
          quantity: it.quantity != null ? String(it.quantity) : "",
          rate: it.rate != null ? String(it.rate) : "",
        };
      }

        const product = products.find(
          (p) => String(p._id) === String(it.productTypeId),
        );
        return {
          brand: it.brand || product?.brand || "",
          productTypeId: it.productTypeId || "",
          numBags:
          it.numBags !== null && it.numBags !== undefined
            ? String(it.numBags)
            : "",
        perBagWeightKg:
          it.perBagWeightKg !== null && it.perBagWeightKg !== undefined
            ? String(it.perBagWeightKg)
            : "",
        netWeightKg:
          it.netWeightKg !== null && it.netWeightKg !== undefined
            ? String(it.netWeightKg)
            : "",
        rate: it.rate !== null && it.rate !== undefined ? String(it.rate) : "",
        rateType: it.rateType || "per_kg",
      };
    });

    if (type === "PURCHASE") {
      setPurchaseForm(form);
      setPurchaseKind(txn.purchaseKind === "PADDY" ? "PADDY" : "MANAGERIAL");
      setPurchaseItems(
        items.length
          ? items
          : [{ ...makeEmptyPurchaseItem(), isPaddy: txn.purchaseKind === "PADDY" }]
      );
      setPurchaseEditingId(txn._id);
    } else {
      setSaleForm(form);
      const kind = txn.saleKind === "CUSTOM" ? "CUSTOM" : "SMJ";
      setSaleKind(kind);
      setSaleItems(items.length ? items : [makeEmptySaleItem()]);
      setSaleEditingId(txn._id);
      const partyId = txn.partyRefId || txn.companyId || "";
      const match = (kind === "SMJ" ? wholesellers : customers).find(
        (c) => String(c._id) === String(partyId)
      );
      if (match) {
        setSaleCustomerMode("EXISTING");
        setQuickCustomer({
          name: match.name || "",
          phone: match.phone || "",
          email: match.email || "",
          address: match.address || "",
        });
      } else {
        setSaleCustomerMode("NEW");
      }
    }
  };

  const openDeleteDialog = (txn) => setDeleteTarget(txn);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/transactions/${deleteTarget._id}`);
      setSaveError("");
      fetchTransactions(deleteTarget.type, 1);
      loadStockBalances();
      setDeleteTarget(null);
    } catch (err) {
      console.error("Delete transaction error:", err);
      setSaveError("Failed to delete transaction");
    } finally {
      setDeleting(false);
    }
  };

  const openPrintDialog = async (txn) => {
    setPrintTxn(txn);
    if (!printSettings) {
      setLoadingSettings(true);
      try {
        const res = await api.get("/settings");
        setPrintSettings(res.data.data || null);
      } catch (err) {
        console.error("Error loading settings for print:", err);
        setSaveError("Failed to load settings for print");
      } finally {
        setLoadingSettings(false);
      }
    }
  };

  // Summary cards (simple)
  const todaySummaryCards = () => {
    const saleTotalToday = saleList.reduce(
      (sum, t) => sum + (t.totalAmount || 0),
      0,
    );
    const purchaseTotalToday = purchaseList.reduce(
      (sum, t) => sum + (t.totalAmount || 0),
      0,
    );

    const cards = [
      {
        title: "Today Sales",
        value: `Rs. ${saleTotalToday.toFixed(0)}`,
        icon: <ArrowUpCircle size={20} />,
        accent: "border-emerald-400",
      },
      {
        title: "Today Purchases",
        value: `Rs. ${purchaseTotalToday.toFixed(0)}`,
        icon: <ArrowDownCircle size={20} />,
        accent: "border-sky-400",
      },
      {
        title: "Transactions Loaded",
        value: saleList.length + purchaseList.length,
        icon: <CreditCard size={20} />,
        accent: "border-amber-400",
      },
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c, idx) => (
          <div
            key={idx}
            className={`bg-white rounded-lg p-4 shadow-sm border-l-4 ${c.accent}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-400">{c.title}</div>
                <div className="text-xl font-semibold text-emerald-900 mt-1">
                  {c.value}
                </div>
              </div>
              <div className="text-emerald-600">{c.icon}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderForm = (type) => {
    const form = type === "PURCHASE" ? purchaseForm : saleForm;
    const items = type === "PURCHASE" ? purchaseItems : saleItems;
    const isEditing =
      type === "PURCHASE" ? !!purchaseEditingId : !!saleEditingId;
    const working = type === "PURCHASE" ? purchaseLoading : saleLoading;
    const fieldErrors = type === "PURCHASE" ? formErrors.purchase : formErrors.sale;
    const itemErrors =
      type === "PURCHASE" ? formErrors.purchaseItems : formErrors.saleItems;

    const total = computeInvoiceTotal(items);
    const { paid: paidComputed, remaining: remainingComputed } =
      computePaidRemaining(form, total);
    const isPartial = form.paymentStatus === "PARTIAL";

    const dateLocked =
      type === "SALE"
        ? !saleDateUnlocked
        : type === "PURCHASE"
          ? !purchaseDateUnlocked
          : false;

    return (
      <form
        onSubmit={(e) => handleSubmit(type, e)}
        className="space-y-4 bg-emerald-50 p-4 rounded-lg"
      >
        {/* Row 1: Date + Customer */}
        <div
          className={`grid grid-cols-1 ${
            type === "PURCHASE" ? "md:grid-cols-1" : "md:grid-cols-1"
          } gap-3`}
        >
          <div className="col-span-1 md:col-span-1">
            <label className="text-xs text-gray-600 flex items-center gap-1">
              Date <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className={`w-full border p-2 rounded text-sm ${
                  dateLocked ? "bg-gray-100 text-gray-600" : ""
                }`}
                value={form.date}
                readOnly={dateLocked}
                onChange={(e) => handleFormChange(type, "date", e.target.value)}
              />
              {settings.additionalStockSettingsEnabled &&
                (type === "SALE" || type === "PURCHASE") && (
                  <button
                    type="button"
                    onClick={() => {
                      if (type === "SALE") {
                        if (saleDateUnlocked) {
                          setSaleDateUnlocked(false);
                          return;
                        }
                        setSaleDatePinDialog({
                          open: true,
                          pin: "",
                          pinError: "",
                        });
                        return;
                      }
                      if (purchaseDateUnlocked) {
                        setPurchaseDateUnlocked(false);
                        return;
                      }
                      setPurchaseDatePinDialog({
                        open: true,
                        pin: "",
                        pinError: "",
                      });
                    }}
                    className="p-2 rounded-lg border border-amber-500 text-amber-700 hover:bg-amber-50"
                    title={
                      type === "SALE"
                        ? saleDateUnlocked
                          ? "Lock date"
                          : "Unlock date"
                        : purchaseDateUnlocked
                          ? "Lock date"
                          : "Unlock date"
                    }
                  >
                    <Lock size={14} />
                  </button>
                )}
            </div>
            <div className="min-h-[14px] text-[11px] text-red-600">
              {fieldErrors.date || ""}
            </div>
          </div>

        {type === "PURCHASE" && (
          <div className="col-span-1 md:col-span-2">
            <div className="text-xs text-gray-600 mb-1">Purchase Type</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPurchaseKind("MANAGERIAL");
                  setPurchaseItems(makeDefaultPurchaseItems("MANAGERIAL"));
                }}
                className={`rounded-lg border px-3 py-2 text-sm text-left ${
                  purchaseKind === "MANAGERIAL"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="font-semibold">Managerial</div>
                <div className="text-[11px] text-gray-500">Tools & supplies</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPurchaseKind("PADDY");
                  setPurchaseItems(makeDefaultPurchaseItems("PADDY"));
                }}
                className={`rounded-lg border px-3 py-2 text-sm text-left ${
                  purchaseKind === "PADDY"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="font-semibold">Paddy (Production)</div>
                <div className="text-[11px] text-gray-500">Raw paddy purchase</div>
              </button>
            </div>
          </div>
        )}

        {type === "SALE" && null}
        </div>

        {type === "SALE" && (
          <div className="grid grid-cols-1 md:grid-cols-1 gap-2">
            <div>
              <div className="text-xs text-gray-600 mb-1">Sales Type</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSaleKind("SMJ")}
                  className={`rounded-lg border px-3 py-2 text-sm text-left ${
                    saleKind === "SMJ"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="font-semibold">SMJ Sales</div>
                  <div className="text-[11px] text-gray-500">Wholesaler</div>
                </button>
                <button
                  type="button"
                  onClick={() => setSaleKind("CUSTOM")}
                  className={`rounded-lg border px-3 py-2 text-sm text-left ${
                    saleKind === "CUSTOM"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="font-semibold">Custom Milling</div>
                  <div className="text-[11px] text-gray-500">Customer</div>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
              <label className="text-xs text-gray-600 flex items-center gap-1">
                {saleKind === "SMJ" ? "Wholeseller Name" : "Customer Name"}{" "}
                <span className="text-red-500">*</span>
              </label>
              {saleCustomerMode === "EXISTING" ? (
                <select
                  className="w-full border p-2 rounded text-sm"
                  value={form.companyId}
                  onChange={(e) => handleFormChange(type, "companyId", e.target.value)}
                >
                  <option value="">
                    {saleKind === "SMJ" ? "Select wholeseller" : "Select customer"}
                  </option>
                  {(saleKind === "SMJ" ? wholesellerOptions : customerOptions).map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                  <option value={OTHER_OPTION}>Add New</option>
                </select>
              ) : (
                // smj-list-field: input + List button dropdown style (typing mode)
                <div className="flex gap-2 relative smj-list-field">
                  <input
                    className={`w-full border p-2 rounded text-sm ${fieldErrors.companyId ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                    value={quickCustomer.name}
                    onChange={(e) => setQuickCustomer((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder={saleKind === "SMJ" ? "Wholeseller name" : "Customer name"}
                  />
                  <button
                    type="button"
                    onClick={() => setSaleCustomerListOpen((v) => !v)}
                    className="px-3 py-2 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    List
                  </button>
                  {saleCustomerListOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 border rounded bg-white max-h-48 overflow-y-auto shadow z-10">
                      {(saleKind === "SMJ" ? wholesellerOptions : customerOptions).length === 0 ? (
                        <div className="px-2 py-2 text-xs text-gray-500">No records</div>
                      ) : (
                        (saleKind === "SMJ" ? wholesellerOptions : customerOptions).map((c) => (
                          <button
                            key={c._id}
                            type="button"
                            onClick={() => {
                              setSaleCustomerMode("EXISTING");
                              setSaleForm((f) => ({ ...f, companyId: c._id }));
                              setQuickCustomer({
                                name: c.name || "",
                                phone: c.phone || "",
                                email: c.email || "",
                                address: c.address || "",
                              });
                              setSaleCustomerListOpen(false);
                            }}
                            className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50"
                          >
                            {c.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
                <div className="min-h-[14px] text-[11px] text-red-600">
                  {fieldErrors.companyId || ""}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 flex items-center gap-1">
                  Phone
                </label>
                <input
                  className={`w-full border p-2 rounded text-sm ${quickCustomerErrors.phone ? "border-red-400 bg-red-50" : ""} ${saleCustomerMode === "EXISTING" ? "bg-gray-100 cursor-not-allowed" : ""}`}
                  value={quickCustomer.phone}
                  onChange={(e) => handleQuickCustomerChange("phone", e.target.value)}
                  placeholder="03XX-XXXXXXX"
                  readOnly={saleCustomerMode === "EXISTING"}
                />
                <div className="min-h-[14px] text-[11px] text-red-600">
                  {saleCustomerMode === "NEW" ? quickCustomerErrors.phone : ""}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 flex items-center gap-1">
                  Email
                </label>
                <input
                  className={`w-full border p-2 rounded text-sm ${quickCustomerErrors.email ? "border-red-400 bg-red-50" : ""} ${saleCustomerMode === "EXISTING" ? "bg-gray-100 cursor-not-allowed" : ""}`}
                  value={quickCustomer.email}
                  onChange={(e) => handleQuickCustomerChange("email", e.target.value)}
                  placeholder="example@email.com"
                  readOnly={saleCustomerMode === "EXISTING"}
                />
                <div className="min-h-[14px] text-[11px] text-red-600">
                  {saleCustomerMode === "NEW" ? quickCustomerErrors.email : ""}
                </div>
              </div>
              <div className="md:col-span-3">
                <label className="text-xs text-gray-600 flex items-center gap-1">
                  Address
                </label>
                <input
                  className={`w-full border p-2 rounded text-sm ${quickCustomerErrors.address ? "border-red-400 bg-red-50" : ""} ${saleCustomerMode === "EXISTING" ? "bg-gray-100 cursor-not-allowed" : ""}`}
                  value={quickCustomer.address}
                  onChange={(e) => handleQuickCustomerChange("address", e.target.value)}
                  placeholder="Address"
                  readOnly={saleCustomerMode === "EXISTING"}
                />
                <div className="min-h-[14px] text-[11px] text-red-600">
                  {saleCustomerMode === "NEW" ? quickCustomerErrors.address : ""}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Items table */}
        {type === "PURCHASE" ? (
          <div className="bg-white border rounded-lg">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="text-sm font-semibold text-emerald-800">
                Purchase Items
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-xs">
                <thead className="bg-emerald-100 text-emerald-800">
                  <tr>
                    {purchaseKind === "PADDY" ? (
                      <>
                        <th className="p-2 text-left">Brand</th>
                        <th className="p-2 text-right">Paddy Weight (kg)</th>
                        <th className="p-2 text-right">Purchase Rate</th>
                        <th className="p-2 text-right">Amount</th>
                      </>
                    ) : (
                      <>
                        <th className="p-2 text-left">Item</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Amount</th>
                        <th className="p-2 text-right">Total</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const lineAmount = computeLineAmount(it);
                    return (
                      <tr key={idx} className="border-t align-top">
                        {purchaseKind === "PADDY" ? (
                          <>
                            <td className="p-2">
                              <input
                                type="text"
                                className="border p-1 rounded w-full bg-gray-100 cursor-not-allowed"
                                value={settings.companyName || "SMJ"}
                                readOnly
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                className="border p-1 rounded w-full text-right"
                                value={it.netWeightKg}
                                onChange={(e) =>
                                  handleItemChange(type, idx, "netWeightKg", e.target.value)
                                }
                              />
                              <div className="min-h-[14px] text-[10px] text-red-600">
                                {itemErrors?.[idx]?.netWeightKg || ""}
                              </div>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                className="border p-1 rounded w-full text-right"
                                value={it.rate}
                                onChange={(e) =>
                                  handleItemChange(type, idx, "rate", e.target.value)
                                }
                              />
                              <div className="min-h-[14px] text-[10px] text-red-600">
                                {itemErrors?.[idx]?.rate || ""}
                              </div>
                            </td>
                            <td className="p-2 text-right">{Math.round(lineAmount)}</td>
                          </>
                        ) : (
                          <>
                            <td className="p-2">
                              {!it.isCustom ? (
                                <select
                                  className="border p-1 rounded w-full"
                                  value={it.itemName || ""}
                                  onChange={(e) =>
                                    handleItemChange(
                                      type,
                                      idx,
                                      "itemSelect",
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="">Select item</option>
                                  {purchaseItemOptions
                                    .filter(
                                      (name) =>
                                        String(name || "").trim().toLowerCase() !== "paddy"
                                    )
                                    .map((name, optIdx) => (
                                      <option key={`${name}-${optIdx}`} value={name}>
                                        {name}
                                      </option>
                                    ))}
                                  <option value={OTHER_OPTION}>Add New</option>
                                </select>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    className="border p-1 rounded w-full"
                                    placeholder="Enter new item"
                                    value={it.itemName}
                                    onChange={(e) =>
                                      handleItemChange(
                                        type,
                                        idx,
                                        "itemName",
                                        e.target.value,
                                      )
                                    }
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleItemChange(
                                        type,
                                        idx,
                                        "itemSelect",
                                        "",
                                      )
                                    }
                                    className="px-2 py-1 text-[10px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                                  >
                                    List
                                  </button>
                                </div>
                              )}
                              <div className="min-h-[14px] text-[10px] text-red-600">
                                {itemErrors?.[idx]?.itemName || ""}
                              </div>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                max="99999"
                                className="border p-1 rounded w-full text-right"
                                value={it.quantity}
                                onChange={(e) =>
                                  handleItemChange(
                                    type,
                                    idx,
                                    "quantity",
                                    e.target.value,
                                  )
                                }
                              />
                              <div className="min-h-[14px] text-[10px] text-red-600">
                                {itemErrors?.[idx]?.quantity || ""}
                              </div>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                className="border p-1 rounded w-full text-right"
                                value={it.rate}
                                onChange={(e) =>
                                  handleItemChange(
                                    type,
                                    idx,
                                    "rate",
                                    e.target.value,
                                  )
                                }
                              />
                              <div className="min-h-[14px] text-[10px] text-red-600">
                                {itemErrors?.[idx]?.rate || ""}
                              </div>
                            </td>
                            <td className="p-2 text-right">
                              {Math.round(lineAmount)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={purchaseKind === "PADDY" ? 4 : 4} className="text-center text-gray-400 p-3">
                        No items added
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-3 pb-3 pt-1 flex items-center justify-between">
              <div className="min-h-[14px] text-[11px] text-red-600">
                {fieldErrors.items || ""}
              </div>
              {purchaseKind !== "PADDY" && (
                <button
                  type="button"
                  onClick={() => addItemRow(type)}
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                >
                  <Plus size={14} /> Add Item
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border rounded-lg">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="text-sm font-semibold text-emerald-800">
                Sale Items
              </div>
              <button
                type="button"
                onClick={() => addItemRow(type)}
                className="flex items-center gap-1 text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-xs">
                <thead className="bg-emerald-100 text-emerald-800">
                  <tr>
                    {saleKind === "CUSTOM" && (
                      <th className="p-2 text-left">Brand</th>
                    )}
                    <th className="p-2 text-left">Product</th>
                    <th className="p-2 text-left">Rate Type</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Unit Weight (kg)</th>
                    <th className="p-2 text-right">Net Weight (kg)</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const lineAmount = computeLineAmount(it);
                    const product = products.find(
                      (p) => String(p._id) === String(it.productTypeId),
                    );
                    const tonKg =
                      Number(product?.conversionFactors?.Ton || 1000) || 1000;

                     // Stock-aware product options for SALE
                     let productOptions = products;
                     let brandOptions = [];
                     let groupedBalanceById = null;
                     if (type === "SALE" && stockBalances.length) {
                       // Only consider rows that represent finished products (exclude Unprocessed Paddy / null productTypeId).
                       const baseRows = stockBalances.filter(
                         (b) =>
                           b &&
                           b.productTypeId &&
                           Number(b.balanceKg || 0) > 0 &&
                           String(b.productTypeName || "")
                             .toLowerCase()
                             .trim() !== "unprocessed paddy",
                       );

                       // For SMJ sales, only allow selling Mill's own stock (settings.companyName).
                       const ownBrand = String(settings?.companyName || "SMJ").trim().toLowerCase();
                       const inStockRows =
                         saleKind === "SMJ"
                           ? baseRows.filter(
                               (r) =>
                                 String(r.companyName || "")
                                   .trim()
                                   .toLowerCase() === ownBrand,
                             )
                           : baseRows;

                       // Brands come from stock rows (companyName is used as brand/trademark in /stock/current).
                       if (saleKind === "CUSTOM") {
                         brandOptions = Array.from(
                           new Set(
            inStockRows
              .map((r) => String(r.companyName || "").trim())
              .filter(Boolean),
          ),
        ).sort();
      }

                       const selectedBrand = String(it.brand || "").trim();
                       const allowedIds = new Set(
                         inStockRows
                           .filter((r) =>
                             saleKind === "CUSTOM"
                               ? (selectedBrand ? String(r.companyName || "").trim() === selectedBrand : true)
                               : true,
                           )
                           .map((r) => String(r.productTypeId)),
                       );

                      const availableProducts = products.filter((p) => allowedIds.has(String(p._id)));

                      // For SMJ sales, we don't pick a brand; show each product name once and
                      // show combined stock across all brands/batches for that product name.
                      if (saleKind === "SMJ") {
                        const normName = (s) => String(s || "").trim().toLowerCase();
                        const rowsByName = new Map();
                        for (const r of inStockRows) {
                          const key = normName(r.productTypeName);
                          if (!key) continue;
                          const prev = rowsByName.get(key) || {
                            name: String(r.productTypeName || "").trim(),
                            totalKg: 0,
                            bestId: null,
                            bestKg: -1,
                          };
                          const kg = Number(r.balanceKg || 0);
                          prev.totalKg += kg;
                          if (kg > prev.bestKg) {
                            prev.bestKg = kg;
                            prev.bestId = String(r.productTypeId);
                            prev.name = String(r.productTypeName || "").trim() || prev.name;
                          }
                          rowsByName.set(key, prev);
                        }

                        const picked = Array.from(rowsByName.values())
                          .filter((x) => x.bestId && x.totalKg > 0)
                          .sort((a, b) => a.name.localeCompare(b.name));

                        groupedBalanceById = new Map();
                        for (const g of picked) {
                          groupedBalanceById.set(String(g.bestId), Number(g.totalKg || 0));
                        }

                        productOptions = picked
                          .map((g) => {
                            // Find product doc for rateType defaults etc; if missing, still show option.
                            const pDoc = availableProducts.find((p) => String(p._id) === String(g.bestId));
                            return {
                              _id: g.bestId,
                              name: g.name,
                              __stockKg: Number(g.totalKg || 0),
                              conversionFactors: pDoc?.conversionFactors,
                              brand: pDoc?.brand || "",
                            };
                          });
                      } else {
                        productOptions = availableProducts;
                      }
                     }

                     const balance =
                       type === "SALE" && it.productTypeId
                        ? (saleKind === "SMJ" && groupedBalanceById
                            ? Number(groupedBalanceById.get(String(it.productTypeId)) || 0)
                            : getStockBalance(it.productTypeId))
                        : null;
                    const netKg = Number(it.netWeightKg || 0);
                    const unitKg =
                      Number(it.perBagWeightKg || 0) ||
                      (it.rateType === "per_kg" ? 1 : 0);
                    const exceeds = balance != null && netKg > balance;
                    const unitLabel =
                      it.rateType === "per_kg"
                        ? "kg"
                        : it.rateType === "per_ton"
                          ? "ton"
                          : "bags";
                    const suggestedQty =
                      exceeds && unitKg
                        ? Math.max(0, Math.floor(balance / unitKg))
                        : null;
                    const perBagReadOnly =
                      type === "SALE" || it.rateType !== "per_bag";
                    const canShowPerTon =
                      type === "SALE"
                        ? balance != null
                          ? balance >= tonKg
                          : true
                        : true;

                    return (
                      <tr key={idx} className="border-t align-top">
                        {saleKind === "CUSTOM" && (
                          <td className="p-2">
                            {type === "SALE" ? (
                              <select
                                className="border p-1 rounded w-full"
                                value={it.brand}
                                onChange={(e) =>
                                  handleItemChange(
                                    type,
                                    idx,
                                    "brand",
                                    e.target.value,
                                  )
                                }
                              >
                                <option value="">Select brand</option>
                                {brandOptions.map((b, i) => (
                                  <option key={`${b}-${i}`} value={b}>
                                    {b}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                            <div className="min-h-[14px] text-[10px] text-red-600">
                              {itemErrors?.[idx]?.brand || ""}
                            </div>
                          </td>
                        )}
                        <td className="p-2">
                          <select
                            className="border p-1 rounded w-full"
                            value={it.productTypeId}
                            onChange={(e) =>
                              handleItemChange(
                                type,
                                idx,
                                "productTypeId",
                                e.target.value,
                              )
                            }
                          >
                            <option value="">
                              {type === "SALE" && it.brand
                                ? "Select stock item"
                                : "Select product"}
                            </option>
                            {productOptions.map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.__stockKg != null ? `${p.name} (${Math.round(Number(p.__stockKg) || 0)} kg)` : p.name}
                              </option>
                            ))}
                          </select>
                          <div className="min-h-[14px] text-[10px] text-red-600">
                            {itemErrors?.[idx]?.productTypeId || ""}
                          </div>
                        </td>
                        <td className="p-2">
                          <select
                            className="border p-1 rounded w-full"
                            value={it.rateType}
                            onChange={(e) =>
                              handleItemChange(
                                type,
                                idx,
                                "rateType",
                                e.target.value,
                              )
                            }
                          >
                            <option value="per_kg">Per Kg</option>
                            <option value="per_bag">Per Bag</option>
                            {canShowPerTon && (
                              <option value="per_ton">Per Ton</option>
                            )}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            max="99999"
                            className={`border p-1 rounded w-full text-right ${exceeds ? "border-red-500 bg-red-50" : ""}`}
                            value={it.numBags}
                            placeholder={
                              it.rateType === "per_kg"
                                ? "KG"
                                : it.rateType === "per_ton"
                                  ? "Ton"
                                  : "Bags"
                            }
                            onChange={(e) =>
                              handleItemChange(
                                type,
                                idx,
                                "numBags",
                                e.target.value,
                              )
                            }
                          />
                          {exceeds && suggestedQty !== null && (
                            <div className="mt-1 text-[10px] text-red-600 text-right">
                              Reduce {unitLabel} to {suggestedQty}
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            className={`border p-1 rounded w-full text-right ${perBagReadOnly ? "bg-gray-50 text-gray-600" : ""} ${exceeds ? "border-red-500 bg-red-50" : ""}`}
                            value={it.perBagWeightKg}
                            readOnly={perBagReadOnly}
                            onChange={(e) =>
                              handleItemChange(
                                type,
                                idx,
                                "perBagWeightKg",
                                e.target.value,
                              )
                            }
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="1"
                            className={`border p-1 rounded w-full text-right bg-gray-50 ${exceeds ? "border-red-500" : ""}`}
                            value={it.netWeightKg}
                            readOnly
                          />
                          {type === "SALE" && it.brand && it.productTypeId && (
                            <div className="mt-1 text-[10px] text-gray-500 text-right">
                              {balance != null
                                ? `Available: ${Math.round(balance)} kg in stock`
                                : "No stock info"}
                            </div>
                          )}
                          <div className="min-h-[14px] text-[10px] text-red-600 text-right">
                            {itemErrors?.[idx]?.netWeightKg || ""}
                          </div>
                        </td>
                        <td className="p-2 text-right">
                          {Math.round(lineAmount)}
                        </td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-gray-400 p-3">
                        No items added
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-3 pb-2 min-h-[14px] text-[11px] text-red-600">
              {fieldErrors.items || ""}
            </div>
          </div>
        )}

        {/* Payment section AFTER items (SALE only) */}
        {type === "SALE" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-end">
          <div className="col-span-1 lg:col-span-2">
            <label className="text-xs text-gray-600">Payment Status</label>
            <div className="flex items-center gap-4 mt-1 text-sm">
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name={`${type}-paymentStatus`}
                  value="PAID"
                  checked={form.paymentStatus === "PAID"}
                  onChange={(e) =>
                    handleFormChange(type, "paymentStatus", e.target.value)
                  }
                />
                <span>Paid</span>
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name={`${type}-paymentStatus`}
                  value="UNPAID"
                  checked={form.paymentStatus === "UNPAID"}
                  onChange={(e) =>
                    handleFormChange(type, "paymentStatus", e.target.value)
                  }
                />
                <span>Unpaid</span>
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name={`${type}-paymentStatus`}
                  value="PARTIAL"
                  checked={form.paymentStatus === "PARTIAL"}
                  onChange={(e) =>
                    handleFormChange(type, "paymentStatus", e.target.value)
                  }
                />
                <span>Partial</span>
              </label>
            </div>
          </div>

          <div className="col-span-1 lg:col-span-1">
            <label className="text-xs text-gray-600">Payment Method</label>
            <select
              className="w-full border p-2 rounded text-sm"
              value={form.paymentMethod}
              onChange={(e) =>
                handleFormChange(type, "paymentMethod", e.target.value)
              }
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="ONLINE_TRANSFER">Online Transfer</option>
            </select>
          </div>

          <div className="col-span-1 lg:col-span-1">
            <label className="text-xs text-gray-600 flex items-center gap-1">
              Due Date
              {form.paymentStatus !== "PAID" && (
                <span className="text-red-500">*</span>
              )}
            </label>
            <input
              type="date"
              className="w-full border p-2 rounded text-sm"
              value={form.dueDate}
              onChange={(e) =>
                handleFormChange(type, "dueDate", e.target.value)
              }
              disabled={form.paymentStatus === "PAID"}
            />
            <div className="min-h-[14px] text-[11px] text-red-600">
              {fieldErrors.dueDate || ""}
            </div>
          </div>

          <div className="col-span-1 lg:col-span-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-gray-600">Total Amount</label>
                <div className="w-full min-w-[120px] border p-2 rounded text-sm bg-gray-50 text-right whitespace-nowrap">
                  Rs. {Math.round(total)}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600">
                  Amount Paid (Rs)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={`w-full min-w-[140px] border p-2 rounded text-sm text-right ${
                    isPartial ? "" : "bg-gray-50 text-gray-600"
                  }`}
                  value={isPartial ? form.partialPaid : String(paidComputed)}
                  onChange={(e) => {
                    if (!isPartial) return;
                    const digits = clampAmountDigits(e.target.value);
                    const capped = digits
                      ? String(Math.min(Number(digits), Math.round(total)))
                      : "";
                    handleFormChange(type, "partialPaid", capped);
                  }}
                  disabled={!isPartial}
                />
                <div className="min-h-[14px] text-[11px] text-red-600">
                  {fieldErrors.partialPaid || ""}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600">Remaining (Rs)</label>
                <div className="w-full min-w-[120px] border p-2 rounded text-sm bg-gray-50 text-right whitespace-nowrap">
                  Rs. {Math.round(remainingComputed)}
                </div>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-red-600 min-h-[16px]">
            {saveError || ""}
          </div>
          <div className="flex gap-2">
            {isEditing && (
              <button
                type="button"
                onClick={() => resetForm(type)}
                className="px-3 py-2 rounded bg-gray-200 text-gray-700 text-sm flex items-center gap-1"
              >
                <AlertCircle size={14} />
                Cancel Edit
              </button>
            )}

            <button
              type="submit"
              disabled={working}
              className="px-3 py-2 rounded bg-emerald-600 text-white text-sm flex items-center gap-1 disabled:opacity-60"
            >
              <Save size={14} />
              {isEditing
                ? working
                  ? "Updating..."
                  : "Update Transaction"
                : working
                  ? "Saving..."
                  : type === "PURCHASE"
                    ? "Save Purchase"
                    : "Save Sale"}
            </button>
          </div>
        </div>
      </form>
    );
  };

  const renderTable = (type) => {
    const list = type === "PURCHASE" ? purchaseList : saleList;
    const total = type === "PURCHASE" ? purchaseTotal : saleTotal;
    const page = type === "PURCHASE" ? purchasePage : salePage;
    const loading = type === "PURCHASE" ? purchaseLoading : saleLoading;
    const colCount = type === "PURCHASE" ? 5 : 9;

    const totalPages = totalPagesFor(total);

    return (
      <div className="bg-white rounded-lg shadow-sm p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-emerald-800">
            Recent {type === "PURCHASE" ? "Purchases" : "Sales"}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page <= 1 || loading}
              onClick={() => fetchTransactions(type, Math.max(1, page - 1))}
              className="px-2 py-1 border rounded disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages || loading}
              onClick={() =>
                fetchTransactions(type, Math.min(totalPages, page + 1))
              }
              className="px-2 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border rounded">
            <thead className="bg-emerald-100 text-emerald-800">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Invoice #</th>
                {type === "SALE" && (
                  <th className="p-2 text-left">Sale Type</th>
                )}
                {type === "SALE" && (
                  <th className="p-2 text-left">Customer</th>
                )}
                <th className="p-2 text-left">Items</th>
                {type === "PURCHASE" && (
                  <th className="p-2 text-right">Total Amount</th>
                )}
                {type === "SALE" && (
                  <th className="p-2 text-right">Total Amount</th>
                )}
                {type === "SALE" && (
                  <th className="p-2 text-right">Amount Paid</th>
                )}
                {type === "SALE" && (
                  <th className="p-2 text-right">Remaining</th>
                )}
                {type === "SALE" && (
                  <th className="p-2 text-left">Payment</th>
                )}
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const dateStr = t.date
                  ? new Date(t.date).toLocaleDateString()
                  : "-";
                const totalAmount = Number(t.totalAmount || 0);
                const paidAmount =
                  t.paymentStatus === "PAID"
                    ? totalAmount
                    : t.paymentStatus === "PARTIAL"
                    ? Number(t.partialPaid || 0)
                    : 0;
                const remainingAmount =
                  t.paymentStatus === "PAID"
                    ? 0
                    : Math.max(totalAmount - paidAmount, 0);
                return (
                  <React.Fragment key={t._id}>
                    <tr className="border-t hover:bg-gray-50">
                      <td className="p-2">{dateStr}</td>
                      <td className="p-2">{t.invoiceNo}</td>
                    {type === "SALE" && (
                      <td className="p-2">
                        {t.saleKind === "CUSTOM" ? "Custom Milling" : "SMJ Sales"}
                      </td>
                    )}
                    {type === "SALE" && (
                      <td className="p-2">{t.companyName}</td>
                    )}
                      <td className="p-2">
                        {(t.items || [])
                          .map((it) => it.itemName || it.productTypeName || "-")
                          .join(", ")}
                      </td>
                      {type === "PURCHASE" && (
                        <td className="p-2 text-right">{Math.round(totalAmount)}</td>
                      )}
                      {type === "SALE" && (
                        <td className="p-2 text-right">
                          {Math.round(totalAmount)}
                        </td>
                      )}
                      {type === "SALE" && (
                        <td className="p-2 text-right">
                          {Math.round(paidAmount)}
                        </td>
                      )}
                      {type === "SALE" && (
                        <td className="p-2 text-right">
                          {Math.round(remainingAmount)}
                        </td>
                      )}
                      {type === "SALE" && (
                        <td className="p-2">
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                t.paymentStatus === "PAID"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : t.paymentStatus === "PARTIAL"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {t.paymentStatus}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {t.paymentMethod || "CASH"}
                            </span>
                          </div>
                        </td>
                      )}
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(type, t)}
                            className="text-blue-500 hover:text-blue-700"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => openPrintDialog(t)}
                            className="text-emerald-600 hover:text-emerald-800"
                            title="Print"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            onClick={() => openDeleteDialog(t)}
                            className="text-red-500 hover:text-red-700"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
              {list.length === 0 && !loading && (
                <tr>
                  <td colSpan={colCount} className="text-center text-gray-400 p-3">
                    No transactions found
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={colCount} className="text-center text-gray-400 p-3">
                    Loading...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const wholesellerOptions = wholesellers;
  const customerOptions = customers;

  const tabs = [
    {
      key: "sale",
      label: "Sales",
      icon: <ArrowUpCircle size={18} />,
    },
    {
      key: "purchase",
      label: "Purchases",
      icon: <ArrowDownCircle size={18} />,
    },
  ];

  return (
    <div className="space-y-6">
      <style>{printStyles}</style>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-emerald-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setSearchParams({ tab: tab.key });
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition border-b-2 ${
              activeTab === tab.key
                ? "text-emerald-700 border-emerald-700 bg-emerald-50"
                : "text-gray-500 border-transparent hover:text-emerald-600 hover:bg-gray-50"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {activeTab === "sale" && (
          <>
            {renderForm("SALE")}
            {renderTable("SALE")}
          </>
        )}
        {activeTab === "purchase" && (
          <>
            {renderForm("PURCHASE")}
            {renderTable("PURCHASE")}
          </>
        )}
      </div>

      {saleDatePinDialog.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Admin PIN
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Enter PIN to unlock the sale date field.
            </p>
            <Pin4Input
              value={saleDatePinDialog.pin}
              onChange={(v) =>
                setSaleDatePinDialog((p) => ({
                  ...p,
                  pin: v.slice(0, 4),
                  pinError: "",
                }))
              }
              onComplete={(entered) => {
                const expected = settings.adminPin || "0000";
                if (entered === expected) {
                  setSaleDateUnlocked(true);
                  setSaleDatePinDialog({ open: false, pin: "", pinError: "" });
                } else {
                  setSaleDatePinDialog((p) => ({
                    ...p,
                    pinError: "Incorrect PIN.",
                  }));
                }
              }}
              error={!!saleDatePinDialog.pinError}
              className="mb-3"
            />
            {saleDatePinDialog.pinError && (
              <p className="text-xs text-red-600 mb-3">
                {saleDatePinDialog.pinError}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() =>
                  setSaleDatePinDialog({ open: false, pin: "", pinError: "" })
                }
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const entered = saleDatePinDialog.pin;
                  const expected = settings.adminPin || "0000";
                  if (entered === expected) {
                    setSaleDateUnlocked(true);
                    setSaleDatePinDialog({
                      open: false,
                      pin: "",
                      pinError: "",
                    });
                  } else {
                    setSaleDatePinDialog((p) => ({
                      ...p,
                      pinError: "Incorrect PIN.",
                    }));
                  }
                }}
                disabled={saleDatePinDialog.pin.length !== 4}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 text-sm"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {purchaseDatePinDialog.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Admin PIN
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Enter PIN to unlock the purchase date field.
            </p>
            <Pin4Input
              value={purchaseDatePinDialog.pin}
              onChange={(v) =>
                setPurchaseDatePinDialog((p) => ({
                  ...p,
                  pin: v.slice(0, 4),
                  pinError: "",
                }))
              }
              onComplete={(entered) => {
                const expected = settings.adminPin || "0000";
                if (entered === expected) {
                  setPurchaseDateUnlocked(true);
                  setPurchaseDatePinDialog({
                    open: false,
                    pin: "",
                    pinError: "",
                  });
                } else {
                  setPurchaseDatePinDialog((p) => ({
                    ...p,
                    pinError: "Incorrect PIN.",
                  }));
                }
              }}
              error={!!purchaseDatePinDialog.pinError}
              className="mb-3"
            />
            {purchaseDatePinDialog.pinError && (
              <p className="text-xs text-red-600 mb-3">
                {purchaseDatePinDialog.pinError}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() =>
                  setPurchaseDatePinDialog({
                    open: false,
                    pin: "",
                    pinError: "",
                  })
                }
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const entered = purchaseDatePinDialog.pin;
                  const expected = settings.adminPin || "0000";
                  if (entered === expected) {
                    setPurchaseDateUnlocked(true);
                    setPurchaseDatePinDialog({
                      open: false,
                      pin: "",
                      pinError: "",
                    });
                  } else {
                    setPurchaseDatePinDialog((p) => ({
                      ...p,
                      pinError: "Incorrect PIN.",
                    }));
                  }
                }}
                disabled={purchaseDatePinDialog.pin.length !== 4}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 text-sm"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-5 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-emerald-900 mb-2">
              Delete Transaction?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete invoice{" "}
              <span className="font-semibold">{deleteTarget.invoiceNo}</span>.
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-2 rounded bg-gray-200 text-gray-700 text-sm"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3 py-2 rounded bg-rose-600 text-white text-sm disabled:opacity-60"
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print dialog (small card) */}
      {printTxn && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 print:bg-transparent">
          <div
            id="print-invoice"
            className="bg-white rounded-lg shadow-lg p-5 w-full max-w-lg print:shadow-none print:border print:border-gray-300"
          >
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <div className="flex items-center gap-3">
                {printSettings?.logoUrl && (
                  <img
                    src={printSettings.logoUrl}
                    alt="Logo"
                    className="h-10 object-contain"
                  />
                )}
                <div>
                  <div className="text-sm font-semibold text-emerald-900">
                    {printSettings?.companyName || "SMJ Rice Mill"}
                  </div>
                  {printSettings?.address && (
                    <div className="text-[11px] text-gray-500">
                      {printSettings.address}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right text-xs text-gray-500">
                <div>Invoice: {printTxn.invoiceNo}</div>
                <div>
                  Date:{" "}
                  {printTxn.date
                    ? new Date(printTxn.date).toLocaleDateString()
                    : "-"}
                </div>
              </div>
            </div>

            <div className="text-xs mb-3">
              <div className="flex justify-between">
                <div>
                  <span className="font-semibold">Type: </span>
                  {printTxn.type}
                </div>
                {printTxn.type !== "PURCHASE" && (
                  <div>
                    <span className="font-semibold">Sale Type: </span>
                    {printTxn.saleKind === "CUSTOM" ? "Custom Milling" : "SMJ Sales"}
                  </div>
                )}
                {printTxn.type !== "PURCHASE" && (
                  <div>
                    <span className="font-semibold">Customer: </span>
                    {printTxn.companyName}
                  </div>
                )}
              </div>
              {printTxn.type !== "PURCHASE" && (
                <div className="flex justify-between mt-1">
                  <div>
                    <span className="font-semibold">Payment: </span>
                    {printTxn.paymentStatus}
                    {printTxn.paymentMethod && (
                      <span className="ml-1 text-gray-500">
                        ({printTxn.paymentMethod})
                      </span>
                    )}
                  </div>
                  {printTxn.dueDate && (
                    <div>
                      <span className="font-semibold">Due Date: </span>
                      {new Date(printTxn.dueDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border rounded mb-3 overflow-hidden">
              {(() => {
                const printHasManagerial = (printTxn.items || []).some(
                  (it) => it.itemName || it.isManagerial,
                );
                return (
                  <table className="w-full text-[11px]">
                    <thead className="bg-emerald-50 text-emerald-900">
                      {printHasManagerial ? (
                        <tr>
                          <th className="p-1 text-left">Item</th>
                          <th className="p-1 text-right">Qty</th>
                          <th className="p-1 text-right">Unit</th>
                          <th className="p-1 text-right">Processing Pricing</th>
                          <th className="p-1 text-right">Amount</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="p-1 text-left">Brand</th>
                          <th className="p-1 text-left">Product</th>
                          <th className="p-1 text-right">Qty</th>
                          <th className="p-1 text-right">Unit (kg)</th>
                          <th className="p-1 text-right">Net (kg)</th>
                          <th className="p-1 text-right">Processing Pricing</th>
                          <th className="p-1 text-right">Amount</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {printTxn.items?.map((it, idx) => (
                        <tr key={idx} className="border-t">
                          {printHasManagerial ? (
                            <>
                              <td className="p-1">{it.itemName || "-"}</td>
                              <td className="p-1 text-right">{it.quantity}</td>
                              <td className="p-1 text-right">
                                {it.unit || "Nos"}
                              </td>
                              <td className="p-1 text-right">{it.rate}</td>
                              <td className="p-1 text-right">
                                {Math.round(it.amount || 0)}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-1">
                                {it.brand ||
                                  products.find(
                                    (p) =>
                                      String(p._id) ===
                                      String(it.productTypeId),
                                  )?.brand ||
                                  "-"}
                              </td>
                              <td className="p-1">{it.productTypeName}</td>
                              <td className="p-1 text-right">{it.numBags}</td>
                              <td className="p-1 text-right">
                                {it.perBagWeightKg}
                              </td>
                              <td className="p-1 text-right">
                                {it.netWeightKg}
                              </td>
                              <td className="p-1 text-right">
                                {it.rate} /{" "}
                                {it.rateType === "per_bag"
                                  ? "bag"
                                  : it.rateType === "per_ton"
                                    ? "ton"
                                    : "kg"}
                              </td>
                              <td className="p-1 text-right">
                                {Math.round(it.amount || 0)}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                      <tr className="border-t bg-emerald-50">
                        <td
                          className="p-1 text-right font-semibold"
                          colSpan={printHasManagerial ? 4 : 6}
                        >
                          Total
                        </td>
                        <td className="p-1 text-right font-semibold">
                          {Math.round(printTxn.totalAmount || 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                );
              })()}
            </div>
            <div className="flex justify-end gap-2 print:hidden">
              <button
                type="button"
                onClick={() => setPrintTxn(null)}
                className="px-3 py-1.5 rounded bg-gray-200 text-gray-700 text-xs"
                disabled={loadingSettings}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs flex items-center gap-1 disabled:opacity-60"
                disabled={loadingSettings}
              >
                <Printer size={12} />
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      <AddOptionModal
        open={quickCustomerModal}
        title={saleKind === "SMJ" ? "Add New Wholeseller" : "Add New Customer"}
        subtitle="This record will be available immediately in the dropdown."
        onClose={closeQuickCustomerModal}
        onSubmit={saveQuickCustomer}
        submitLabel={saleKind === "SMJ" ? "Add Wholeseller" : "Add Customer"}
        loading={quickCustomerSaving}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">
              {saleKind === "SMJ" ? "Wholeseller Name" : "Customer Name"} *
            </label>
            <input
              type="text"
              className={`w-full rounded px-3 py-2 text-sm border ${
                quickCustomerTouched.name && quickCustomerErrors.name
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300"
              }`}
              value={quickCustomer.name}
              placeholder={saleKind === "SMJ" ? "Wholeseller Name *" : "Customer Name *"}
              onChange={(e) => handleQuickCustomerChange("name", e.target.value)}
            />
            {quickCustomerTouched.name && quickCustomerErrors.name ? (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} />
                {quickCustomerErrors.name} ({quickCustomer.name.length}/{QUICK_CUSTOMER_LIMITS.name})
              </p>
            ) : null}
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Phone (03XX-XXXXXXX)</label>
            <input
              type="text"
              className={`w-full rounded px-3 py-2 text-sm border ${
                quickCustomerTouched.phone && quickCustomerErrors.phone
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300"
              }`}
              value={quickCustomer.phone}
              placeholder="Phone (03XX-XXXXXXX)"
              onChange={(e) => handleQuickCustomerChange("phone", e.target.value)}
            />
            {quickCustomerTouched.phone && quickCustomerErrors.phone ? (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} />
                {quickCustomerErrors.phone} ({quickCustomer.phone.length}/{QUICK_CUSTOMER_LIMITS.phone})
              </p>
            ) : null}
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Email</label>
            <input
              type="email"
              className={`w-full rounded px-3 py-2 text-sm border ${
                quickCustomerTouched.email && quickCustomerErrors.email
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300"
              }`}
              value={quickCustomer.email}
              placeholder="Email"
              onChange={(e) => handleQuickCustomerChange("email", e.target.value)}
            />
            {quickCustomerTouched.email && quickCustomerErrors.email ? (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} />
                {quickCustomerErrors.email} ({quickCustomer.email.length}/{QUICK_CUSTOMER_LIMITS.email})
              </p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Address</label>
            <input
              type="text"
              className={`w-full rounded px-3 py-2 text-sm border ${
                quickCustomerTouched.address && quickCustomerErrors.address
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300"
              }`}
              value={quickCustomer.address}
              placeholder="Address"
              onChange={(e) => handleQuickCustomerChange("address", e.target.value)}
            />
            {quickCustomerTouched.address && quickCustomerErrors.address ? (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} />
                {quickCustomerErrors.address} ({quickCustomer.address.length}/{QUICK_CUSTOMER_LIMITS.address})
              </p>
            ) : null}
          </div>
        </div>
      </AddOptionModal>

    </div>
  );
}
