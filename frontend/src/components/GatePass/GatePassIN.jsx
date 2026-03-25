import React, { useEffect, useState } from "react";
import { Edit2, Trash2, Printer, X, Plus } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";
import DataTable from "../ui/DataTable";
import AddOptionModal from "../ui/AddOptionModal";

const UNITS = ["kg", "ton", "bags", "pcs", "mounds"];
const PADDY_UNITS = ["kg", "ton"];
const OTHER_OPTION = "__OTHER__";
const createBrandModalState = () => ({
  open: false,
  value: "",
  valueOther: "",
  deleteValue: "",
  productRows: [],
  draft: {
    nameSelect: "",
    nameOther: "",
    showList: false,
    bagKg: "65",
    tonKg: "1000",
    pricePerKg: "",
  },
  saving: false,
  deleting: false,
  renaming: false,
  errors: { value: "", rows: [], rowsGeneral: "", draft: {} },
});

export default function GatePassIN() {
  const [brandOptions, setBrandOptions] = useState([]);
  const [productCatalog, setProductCatalog] = useState([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [form, setForm] = useState({
    truckNo: "",
    supplier: "",
    driverName: "",
    driverContact: "",
    freightCharges: "",
  });
  const [items, setItems] = useState([
    { itemType: "Paddy", brand: "", quantity: "", unit: "kg" },
  ]);

  const toggleInvoiceId = (id) => {
    const sid = String(id || "");
    if (!sid) return;
    setSelectedInvoiceIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
    clearFieldError("invoiceId");
  };

  const [errors, setErrors] = useState({});
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [settings, setSettings] = useState(null);
  const [brandModal, setBrandModal] = useState(createBrandModalState);

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
    expectedText: "",
  });
  const [confirmInput, setConfirmInput] = useState("");

  // Validation regex
  const nameRegex = /^[A-Za-z\s]+$/;
  const truckRegex = /^[A-Z]{2,4}-\d{3,4}$/;
  const contactRegex = /^03\d{2}-\d{7}$/; // 03XX-XXXXXXX

  const setFieldError = (field, msg) =>
    setErrors((p) => ({ ...p, [field]: msg }));
  const clearFieldError = (field) =>
    setErrors((p) => {
      const c = { ...p };
      delete c[field];
      return c;
    });

  // Validation functions
  const validateTruckNo = (v) => {
    if (!v) return "Truck number is required.";
    if (v.length < 6) return "Truck number too short.";
    if (v.length > 12) return "Truck number too long.";
    if (!truckRegex.test(v)) return "Format: ABC-123 or AB-1234";
    return "";
  };

  const validateDriverName = (v) =>
    !v ? "" : nameRegex.test(v) ? "" : "Driver name: letters and spaces only.";

  const validateDriverContact = (v) => {
    if (!v) return ""; // Optional
    if (!contactRegex.test(v)) return "Format: 03XX-XXXXXXX (11 digits)";
    return "";
  };

  const needsBrand = () => {
    // Company name is required only when receiving Production/Paddy stock.
    const hasManualProduction = (items || []).some((it) => {
      const name = String(it?.itemType || "").trim().toLowerCase();
      const qty = Number(it?.quantity || 0);
      return (name === "paddy" || name === "unprocessed paddy") && qty > 0;
    });

    const invoice = selectedInvoiceIds.length
      ? purchaseInvoices.find((t) => String(t._id) === String(selectedInvoiceIds[0]))
      : null;
    const hasInvoiceProduction = (invoice?.items || []).some((it) => !it?.isManagerial);

    return hasManualProduction || hasInvoiceProduction;
  };

  const validateField = (name, value) => {
    let msg = "";
    if (name === "truckNo") msg = validateTruckNo(value);
    if (name === "supplier") {
      if (!needsBrand()) msg = "";
      else {
        const manualPaddy = (items || []).filter((it) => {
          const name = String(it?.itemType || "").trim().toLowerCase();
          const qty = Number(it?.quantity || 0);
          return (name === "paddy" || name === "unprocessed paddy") && qty > 0;
        });
        const perRowOk =
          manualPaddy.length > 0 &&
          manualPaddy.every((it) => String(it?.brand || "").trim() !== "");
        msg = value || perRowOk ? "" : "Company Name is required.";
      }
    }
    if (name === "driverName")
      msg = value ? validateDriverName(value) : "Driver name is required.";
    if (name === "driverContact")
      msg = value ? validateDriverContact(value) : "Driver contact is required.";
    if (name === "freightCharges")
      msg = value ? "" : "Freight charges are required.";
    if (msg) setFieldError(name, msg);
    else clearFieldError(name);
  };

  const validateForm = () => {
    const e1 = validateTruckNo(form.truckNo);
    const manualPaddy = (items || []).filter((it) => {
      const name = String(it?.itemType || "").trim().toLowerCase();
      const qty = Number(it?.quantity || 0);
      return (name === "paddy" || name === "unprocessed paddy") && qty > 0;
    });
    const perRowOk =
      manualPaddy.length > 0 &&
      manualPaddy.every((it) => String(it?.brand || "").trim() !== "");
    const e2 = needsBrand()
      ? form.supplier || perRowOk
        ? ""
        : "Company Name is required."
      : "";
    const e3 = form.driverName
      ? validateDriverName(form.driverName)
      : "Driver name is required.";
    const e4 = form.driverContact
      ? validateDriverContact(form.driverContact)
      : "Driver contact is required.";
    const e5 = form.freightCharges ? "" : "Freight charges are required.";

    const newErr = {};
    if (e1) newErr.truckNo = e1;
    if (e2) newErr.supplier = e2;
    if (e3) newErr.driverName = e3;
    if (e4) newErr.driverContact = e4;
    if (e5) newErr.freightCharges = e5;

    if (selectedInvoiceIds.length && !purchaseInvoices.find((t) => String(t._id) === String(selectedInvoiceIds[0]))) {
      newErr.invoiceId = "Select a valid invoice.";
    }
    setErrors(newErr);
    if (Object.keys(newErr).length > 0) {
      const firstKey = Object.keys(newErr)[0];
      setTimeout(() => {
        document.getElementById(`field-${firstKey}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
      return false;
    }
    return true;
  };

  // Format truck input
  const formatTruckInput = (raw) => {
    let s = raw.toUpperCase();
    s = s.replace(/[^A-Z0-9]/g, "");
    const letters = (s.match(/^[A-Z]*/)[0] || "").slice(0, 4);
    const digits = s.slice(letters.length).replace(/[^0-9]/g, "").slice(0, 4);
    if (!digits) return letters;
    return `${letters}-${digits}`;
  };

  // Format contact input: 03XX-XXXXXXX
  const formatContactInput = (raw) => {
    let s = raw.replace(/[^\d]/g, ""); // Only digits
    if (s.length <= 4) return s;
    return `${s.slice(0, 4)}-${s.slice(4, 11)}`;
  };

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.get("/settings");
        if (res.data && res.data.success !== false) {
          const s = res.data.data || res.data;
          setSettings(s);
          if (Array.isArray(s.brandOptions)) {
            setBrandOptions((prev) =>
              Array.from(
                new Set([...(prev || []), ...s.brandOptions.filter(Boolean)])
              ).sort()
            );
          }
        }
      } catch {}
    };
    loadSettings();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await api.get("/transactions", {
        params: { type: "PURCHASE", limit: 5000, skip: 0 },
      });
      setPurchaseInvoices(res.data?.data || []);
    } catch {}
  };

  // Load purchase invoices
  useEffect(() => {
    fetchInvoices();
  }, []);

  // Load company name list for paddy ownership
  useEffect(() => {
    const loadBrands = async () => {
      try {
        const res = await api.get("/product-types");
        const rows = res.data?.data || [];
        setProductCatalog(rows);
        const brands = Array.from(
          new Set(rows.map((r) => String(r.brand || "").trim()).filter(Boolean))
        ).sort();
        setBrandOptions((prev) =>
          Array.from(new Set([...(prev || []), ...brands])).sort()
        );
      } catch {}
    };
    loadBrands();
  }, []);


  // Fetch rows
  const fetchRows = async () => {
    try {
      setLoading(true);
      const params = {
        page: 1,
        limit: 1000,
        type: "IN",
      };
      const res = await api.get("/gatepasses", { params });
      if (res.data && res.data.success === false)
        throw new Error(res.data.message || "Failed");
      setRows(res.data.data || []);
    } catch (err) {
      toast.error(err.message || "Unable to fetch gate passes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line
  }, []);

  const filteredInvoices = (purchaseInvoices || []).filter(
    (inv) => !inv?.gatePassUsed || selectedInvoiceIds.includes(String(inv?._id))
  );
  const productNameOptions = Array.from(
    new Set((productCatalog || []).map((p) => String(p.name || "").trim()).filter(Boolean))
  ).sort();

  const normalizeText = (v) => String(v || "").trim().toLowerCase();

  const makeProductRow = (name, template = null) => {
    const bag = Number(template?.conversionFactors?.Bag || 65);
    const ton = Number(template?.conversionFactors?.Ton || 1000);
    const kgPrice = Number(template?.pricePerKg || 0);
    return {
      name: String(name || "").trim(),
      bagKg: String(bag || 65),
      tonKg: String(ton || 1000),
      pricePerKg: String(Math.round(kgPrice || 0)),
      pricePerBag: String(
        Math.round(Number(template?.pricePerBag ?? kgPrice * bag) || 0)
      ),
      pricePerTon: String(
        Math.round(Number(template?.pricePerTon ?? kgPrice * ton) || 0)
      ),
    };
  };

  const validateBrandValue = (value) => {
    const v = String(value || "").trim();
    if (!v) return "Company Name is required";
    if (v.length > 100) return "Company Name must be 100 characters or less";
    return "";
  };

  const getBrandModalName = (modal) =>
    String(
      modal?.value === OTHER_OPTION ? modal?.valueOther || "" : modal?.value || ""
    ).trim();

  const sanitizeBrandText = (value, max = 100) =>
    String(value || "")
      .replace(/[^a-zA-Z0-9\s.,&()\-]/g, "")
      .slice(0, max);

  const toTitleCase = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const sanitizeIntegerText = (value, max = 8) =>
    String(value || "")
      .replace(/\D/g, "")
      .slice(0, max);

  const formatGatePassSearch = (value) => {
    const raw = String(value || "").toUpperCase();
    const cleaned = raw.replace(/[^A-Z0-9]/g, "");
    let prefix = "";
    let digits = "";

    for (const ch of cleaned) {
      if (prefix.length < 3) {
        if (prefix === "" && ch === "G") prefix = "G";
        else if (prefix === "G" && ch === "P") prefix = "GP";
        else if (prefix === "GP" && ch === "I") prefix = "GPI";
        else if (/\d/.test(ch)) {
          // Ignore digits until prefix is complete.
        }
      } else if (/\d/.test(ch)) {
        digits += ch;
      }
    }

    if (prefix.length < 3) return prefix;

    const year = digits.slice(0, 4);
    const gpNo = digits.slice(4, 9);
    let out = "GPI-";
    out += year;
    if (year.length === 4) out += "-";
    out += gpNo;
    return out;
  };

  const validateBrandRow = (row = {}) => {
    const errors = {};
    const name = String(row.name || "").trim();
    if (!name) errors.name = "Product name is required";
    if (!String(row.bagKg || "").trim()) errors.bagKg = "Required";
    if (!String(row.tonKg || "").trim()) errors.tonKg = "Required";
    if (!String(row.pricePerKg || "").trim()) errors.pricePerKg = "Required";
    if (!errors.bagKg && Number(row.bagKg) <= 0) errors.bagKg = "Must be greater than 0";
    if (!errors.tonKg && Number(row.tonKg) <= 0) errors.tonKg = "Must be greater than 0";
    return errors;
  };

  const validateBrandModalBeforeSave = (modal) => {
    const valueError = validateBrandValue(getBrandModalName(modal));
    const brandName = getBrandModalName(modal);
    const brandExists = (brandOptions || []).some(
      (b) => normalizeText(b) === normalizeText(brandName)
    );
    const isNewBrand = String(modal.valueOther || "").trim().length > 0;
    const duplicateBrandError =
      brandExists && isNewBrand ? "Company Name already exists." : "";
    const rows = Array.isArray(modal.productRows) ? modal.productRows : [];
    const rowErrors = rows.map((row) => validateBrandRow(row));
    const hasRowErrors = rowErrors.some((e) => Object.keys(e).length > 0);
    const cleanedNames = rows
      .map((r) => String(r.name || "").trim().toLowerCase())
      .filter(Boolean);
    const duplicateName =
      cleanedNames.length !== new Set(cleanedNames).size
        ? "Duplicate product names are not allowed."
        : "";
    const rowsGeneral =
      rows.length === 0
        ? "Add at least one product row."
        : duplicateName || "";

    return {
      isValid: !valueError && !duplicateBrandError && !hasRowErrors && !rowsGeneral,
      errors: { value: valueError || duplicateBrandError, rows: rowErrors, rowsGeneral },
    };
  };

  const getDraftProductName = () =>
    String(brandModal.draft?.nameOther || "").trim();

  const getBrandProducts = (brandName) =>
    (productCatalog || [])
      .filter((p) => normalizeText(p.brand) === normalizeText(brandName))
      .map((p) => ({
        name: String(p.name || "").trim(),
        bagKg: String(Number(p?.conversionFactors?.Bag || 65)),
        tonKg: String(Number(p?.conversionFactors?.Ton || 1000)),
        pricePerKg: String(Math.round(Number(p?.pricePerKg || 0))),
        pricePerBag: String(Math.round(Number(p?.pricePerBag || 0))),
        pricePerTon: String(Math.round(Number(p?.pricePerTon || 0))),
      }));

  const handleBrandDraftChange = (field, rawValue) => {
    setBrandModal((prev) => {
      const draft = { ...(prev.draft || {}) };
      if (field === "nameSelect") {
        draft.nameSelect = rawValue;
        if (rawValue !== OTHER_OPTION) draft.nameOther = "";
        const template = (productCatalog || []).find(
          (p) =>
            normalizeText(p.brand) === normalizeText(prev.value) &&
            normalizeText(p.name) === normalizeText(rawValue)
        );
        if (template) {
          draft.bagKg = String(Number(template?.conversionFactors?.Bag || 65));
          draft.tonKg = String(Number(template?.conversionFactors?.Ton || 1000));
          draft.pricePerKg = String(Math.round(Number(template?.pricePerKg || 0)));
        }
      } else if (field === "nameOther") {
        draft.nameOther = sanitizeBrandText(rawValue, 80);
        draft.showList = false;
      } else if (field === "toggleProductList") {
        draft.showList = !draft.showList;
      } else if (field === "bagKg" || field === "tonKg") {
        draft[field] = sanitizeIntegerText(rawValue, 5);
      } else {
        draft[field] = sanitizeIntegerText(rawValue, 8);
      }
      return {
        ...prev,
        draft,
        errors: { ...(prev.errors || {}), draft: {}, rowsGeneral: "" },
      };
    });
  };

  const addDraftProductRow = () => {
    const name = getDraftProductName();
    const row = {
      name,
      bagKg: String(brandModal.draft?.bagKg || "").trim(),
      tonKg: String(brandModal.draft?.tonKg || "").trim(),
      pricePerKg: String(brandModal.draft?.pricePerKg || "").trim(),
    };
    const rowError = validateBrandRow(row);
    if (Object.keys(rowError).length > 0) {
      setBrandModal((prev) => ({
        ...prev,
        errors: { ...(prev.errors || {}), draft: rowError },
      }));
      return;
    }
    const duplicate = (brandModal.productRows || []).some(
      (r) => normalizeText(r.name) === normalizeText(name)
    );
    if (duplicate) {
      toast.error("Product already exists in this company list.");
      return;
    }
    setBrandModal((prev) => ({
      ...prev,
      productRows: [
        ...(prev.productRows || []),
        {
          ...row,
          pricePerBag: String(
            Math.round(Number(row.pricePerKg || 0) * Number(row.bagKg || 0))
          ),
          pricePerTon: String(
            Math.round(Number(row.pricePerKg || 0) * Number(row.tonKg || 0))
          ),
        },
      ],
      draft: {
        nameSelect: "",
        nameOther: "",
        bagKg: prev.draft?.bagKg || "65",
        tonKg: prev.draft?.tonKg || "1000",
        pricePerKg: "",
      },
      errors: { ...(prev.errors || {}), draft: {}, rowsGeneral: "" },
    }));
  };

  const selectedBrandName = getBrandModalName(brandModal);
  // Handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    let v = value;
    if (name === "truckNo") {
      v = formatTruckInput(value);
    }
    if (name === "driverName") {
      if (value !== "Other") {
        v = value.replace(/[^A-Za-z\s]/g, "");
      }
      v = v.replace(/\s+/g, " ");
    }
    if (name === "driverContact") {
      v = formatContactInput(value);
    }
    if (name === "supplier" && value === OTHER_OPTION) {
      setBrandModal({ ...createBrandModalState(), open: true });
      return;
    }
    if (name === "freightCharges") {
      v = value.replace(/[^\d.]/g, "");
    }
    setForm((prev) => ({ ...prev, [name]: v }));
    validateField(name, v);
  };


  const saveBrandFromModal = async () => {
    const validation = validateBrandModalBeforeSave(brandModal);
    setBrandModal((prev) => ({ ...prev, errors: validation.errors }));
    if (!validation.isValid) {
      toast.error("Please fix company name form errors.");
      return;
    }
    const brandName = getBrandModalName(brandModal);

    const nextOptions = Array.from(
      new Set([...(brandOptions || []), brandName])
    ).sort();
    setBrandModal((prev) => ({ ...prev, saving: true }));
    try {
      await api.put("/settings", { brandOptions: nextOptions });
      setBrandOptions(nextOptions);
      const rows = (brandModal.productRows || []).filter(
        (r) => String(r.name || "").trim() !== ""
      );
      let changedCount = 0;
      for (const row of rows) {
        const name = String(row.name || "").trim();
        const bagKg = Math.max(1, Number(row.bagKg || 65));
        const tonKg = Math.max(1, Number(row.tonKg || 1000));
        const priceKg = Math.max(0, Number(row.pricePerKg || 0));
        const priceBag = Math.max(
          0,
          Number(row.pricePerBag || Math.round(priceKg * bagKg) || 0)
        );
        const priceTon = Math.max(
          0,
          Number(row.pricePerTon || Math.round(priceKg * tonKg) || 0)
        );

        const existing = (productCatalog || []).find(
          (p) =>
            String(p.brand || "").trim().toLowerCase() === brandName.toLowerCase() &&
            String(p.name || "").trim().toLowerCase() === name.toLowerCase()
        );
        const payload = {
          name,
          brand: brandName,
          baseUnit: "KG",
          allowableSaleUnits: ["Bag", "Ton", "KG"],
          conversionFactors: { KG: 1, Bag: bagKg, Ton: tonKg },
          pricePerKg: Math.round(priceKg),
          pricePerBag: Math.round(priceBag),
          pricePerTon: Math.round(priceTon),
        };
        try {
          if (existing?._id) {
            await api.put(`/product-types/${existing._id}`, payload);
          } else {
            await api.post("/product-types", payload);
          }
          changedCount += 1;
        } catch {
          // continue remaining rows
        }
      }

      const pRes = await api.get("/product-types");
      setProductCatalog(pRes.data?.data || []);

      setForm((prev) => ({ ...prev, supplier: brandName }));
      clearFieldError("supplier");
      setBrandModal(createBrandModalState());
      toast.success(
        changedCount > 0
          ? `Company Name saved with ${changedCount} product row(s).`
          : "Company Name added."
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to add company name");
      setBrandModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const handleInvoiceChange = (id) => {
    // handled by <select multiple>
    // Important: supplier is used as company name for paddy ownership.
    // Linking an invoice should NOT overwrite the selected brand.
  };

  const handleItemChange = (idx, field, value) => {
    const updated = [...items];
    if (field === "quantity") {
      updated[idx][field] = value.replace(/[^\d.]/g, "");
    } else {
      updated[idx][field] = value;
    }
    setItems(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const normalizeUnit = (unit) => {
      const u = String(unit || "").toLowerCase().trim();
      if (u === "nos" || u === "no" || u === "nos.") return "pcs";
      if (u === "pcs" || u === "pc") return "pcs";
      if (u === "kg" || u === "ton" || u === "bags" || u === "mounds") return u;
      return "pcs";
    };

    const invoice = selectedInvoiceIds.length
      ? purchaseInvoices.find((t) => String(t._id) === String(selectedInvoiceIds[0]))
      : null;
    if (selectedInvoiceIds.length && !invoice) {
      toast.error("Select a valid purchase invoice.");
      return;
    }

    const labelForInvoiceItem = (it) =>
      it.itemName || it.productTypeName || "SMJ Own";
    const itemsFromInvoice = invoice
      ? (invoice.items || []).map((it) => {
          const qty =
            it.netWeightKg != null && it.netWeightKg !== ""
              ? Number(it.netWeightKg || 0)
              : Number(it.quantity || 0);
          const unit =
            it.netWeightKg != null && it.netWeightKg !== ""
              ? "kg"
              : it.unit || "pcs";
          return {
            itemType: labelForInvoiceItem(it),
            stockType: it.isManagerial ? "Managerial" : "Production",
            customItemName: "",
            quantity: qty,
            unit: normalizeUnit(unit),
          };
        })
      : [];
    const manualItems = items
      .filter((it) => it.itemType && Number(it.quantity) > 0)
      .map((it) => {
        const isPaddy = String(it.itemType || "").toLowerCase() === "paddy";
        return {
          itemType: it.itemType,
          stockType: isPaddy ? "Production" : "Managerial",
          brand: isPaddy ? String(it.brand || "").trim() : "",
          customItemName: "",
          quantity: Number(it.quantity),
          unit: normalizeUnit(it.unit),
        };
      });

    const firstPaddyBrand =
      manualItems.find(
        (it) =>
          String(it?.itemType || "").toLowerCase() === "paddy" &&
          String(it?.brand || "").trim() !== ""
      )?.brand || "";

    const payload = {
      ...form,
      supplier: String(form.supplier || "").trim() || firstPaddyBrand || "",
      type: "IN",
      invoiceIds: selectedInvoiceIds.map((id) => purchaseInvoices.find((t) => String(t._id) === String(id))?._id).filter(Boolean),
      invoiceId: invoice ? invoice._id : undefined,
      invoiceNo: invoice ? invoice.invoiceNo : undefined,
      items: [...itemsFromInvoice, ...manualItems],
      freightCharges: form.freightCharges
        ? Number(form.freightCharges)
        : undefined,
    };

    try {
      const url = editingId ? `/gatepasses/${editingId}` : "/gatepasses";
      const method = editingId ? "put" : "post";
      const res = await api[method](url, payload);
      if (res.data && res.data.success === false)
        throw new Error(res.data.message || "Save failed");
      toast.success(editingId ? "Gate pass updated." : "Gate pass created.");

      // Reset form
      setForm({
        truckNo: "",
        supplier: "",
        driverName: "",
        driverContact: "",
        freightCharges: "",
      });
      setSelectedInvoiceIds([]);
      setItems([{ itemType: "Paddy", brand: "", quantity: "", unit: "kg" }]);
      setEditingId(null);
      setErrors({});
      fetchRows();
      fetchInvoices();
    } catch (err) {
      toast.error(err.message || "Unable to save.");
      document.getElementById("gatepass-in-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const handleEdit = (row) => {
    setForm({
      truckNo: row.truckNo || "",
      supplier: row.supplier || "",
      driverName: row.driverName || "",
      driverContact: row.driverContact || "",
      freightCharges: row.freightCharges ? String(row.freightCharges) : "",
    });
    const ids = Array.isArray(row.invoiceIds) && row.invoiceIds.length
      ? row.invoiceIds
      : (row.invoiceId ? [row.invoiceId] : []);
    setSelectedInvoiceIds(ids.map((x) => String(x)));
    const rowItems = (row.items || []).map((it) => ({
      itemType: it.itemType || it.customItemName || "SMJ Own",
      brand: String(it.brand || "").trim() || (String(it.itemType || "").toLowerCase() === "paddy" ? (row.supplier || "") : ""),
      quantity: it.quantity ? String(it.quantity) : "",
      unit: it.unit || "kg",
    }));
    setItems(
      rowItems.length > 0 ? rowItems : [{ itemType: "Paddy", brand: "", quantity: "", unit: "kg" }]
    );

    setEditingId(row._id);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (row) => {
    setConfirmDialog({
      open: true,
      title: "Delete Gate Pass",
      message: `Are you sure you want to delete Gate Pass ${
        row.gatePassNo || ""
      }? This will also remove related stock entries. This action cannot be undone.`,
      onConfirm: async () => {
        if (confirmDialog.expectedText && confirmInput !== confirmDialog.expectedText) {
          toast.error("Please type the gate pass number to confirm.");
          return;
        }
        try {
          const res = await api.delete(`/gatepasses/${row._id}`);
          if (res.data && res.data.success === false)
            throw new Error(res.data.message || "Delete failed");
          toast.success("Gate pass deleted.");
          fetchRows();
        } catch (err) {
          toast.error(err.message || "Unable to delete");
        } finally {
          setConfirmDialog({
            open: false,
            title: "",
            message: "",
            onConfirm: null,
            expectedText: "",
          });
          setConfirmInput("");
        }
      },
      expectedText: row.gatePassNo || "DELETE",
    });
    setConfirmInput("");
  };

  // Print window - A5 size (148mm x 210mm)
  const openPrintWindow = async (row) => {
    const win = window.open("", "_blank", "width=600,height=842");
    if (!win) return;

    const millName = settings?.companyName || settings?.name || "Rice Mill";
    const millAddress = settings?.companyAddress || settings?.address || "";
    const apiHost = api.defaults.baseURL.replace(/\/api\/?$/, "");
    const logo =
      settings?.logoUrl ||
      settings?.logo ||
      settings?.logoPath ||
      `${apiHost}/uploads/logo.png`;

    const logoHtml = logo
      ? `<img src="${logo}" style="height:50px;margin-right:12px;" alt="logo" />`
      : `<div style="width:50px;height:50px;background:#d1fae5;color:#047857;display:inline-flex;align-items:center;justify-content:center;font-weight:700;margin-right:12px;border-radius:8px;font-size:20px;">GP</div>`;

    const paddyBrands = Array.from(
      new Set(
        (row.items || [])
          .filter((it) => String(it?.itemType || "").toLowerCase() === "paddy")
          .map((it) => String(it?.brand || row.supplier || "").trim())
          .filter(Boolean),
      ),
    );

    let itemsHtml = "";
    if (row.items && row.items.length > 0) {
      itemsHtml = row.items
        .map((item) => {
          const isPaddy = String(item?.itemType || "").toLowerCase() === "paddy";
          const paddyBrand = isPaddy
            ? String(item?.brand || row.supplier || "").trim()
            : "";
          const displayName =
            item.itemType === "Other" && item.customItemName
              ? `${item.itemType} (${item.customItemName})`
              : item.itemType || "-";
          const nameWithBrand = isPaddy
            ? `Unprocessed Paddy${paddyBrand ? ` (${paddyBrand})` : ""}`
            : displayName;
          return `<tr>
          <td style="border:1px solid #ddd;padding:6px;">${nameWithBrand}</td>
          <td style="border:1px solid #ddd;padding:6px;text-align:right;">${
            item.quantity || 0
          } ${item.unit || ""}</td>
        </tr>`;
        })
        .join("");
    }

    // Invoice details (optional): show linked invoice numbers and their items on the slip.
    let invoiceHtml = "";
    try {
      const ids = Array.isArray(row.invoiceIds) && row.invoiceIds.length
        ? row.invoiceIds
        : (row.invoiceId ? [row.invoiceId] : []);
      const invoiceDocs = await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await api.get(`/transactions/${id}`);
            return r.data?.data || null;
          } catch {
            return null;
          }
        })
      );
      const invoices = invoiceDocs.filter(Boolean);
      if (invoices.length > 0) {
        const invBlocks = invoices
          .map((inv) => {
            const invNo = inv.invoiceNo || "-";
            const invItems = Array.isArray(inv.items) ? inv.items : [];
            const rows = invItems
              .map((it) => {
                const label = it.itemName || it.productTypeName || "Item";
                const qty =
                  it.netWeightKg != null && it.netWeightKg !== ""
                    ? `${Math.round(Number(it.netWeightKg || 0))} kg`
                    : `${Math.round(Number(it.quantity || 0))} ${it.unit || ""}`;
                return `<tr>
                  <td style="border:1px solid #ddd;padding:6px;">${label}</td>
                  <td style="border:1px solid #ddd;padding:6px;text-align:right;">${qty}</td>
                </tr>`;
              })
              .join("");

            return `
              <div style="margin-top:10px;">
                <div style="font-weight:700;color:#065f46;margin-bottom:6px;">Invoice: ${invNo}</div>
                <table style="width:100%;border-collapse:collapse;">
                  <thead>
                    <tr>
                      <th style="border:1px solid #ddd;padding:6px;text-align:left;background:#f3f4f6;">Product</th>
                      <th style="border:1px solid #ddd;padding:6px;text-align:right;background:#f3f4f6;">Qty</th>
                    </tr>
                  </thead>
                  <tbody>${rows || `<tr><td colspan="2" style="border:1px solid #ddd;padding:6px;color:#6b7280;">No items</td></tr>`}</tbody>
                </table>
              </div>
            `;
          })
          .join("");

        invoiceHtml = `
          <div style="margin-top:12px;border-top:1px solid #e5e7eb;padding-top:10px;">
            <div style="font-weight:800;color:#111827;margin-bottom:6px;">Invoice Details</div>
            ${invBlocks}
          </div>
        `;
      } else {
        const nos = Array.isArray(row.invoiceNos) && row.invoiceNos.length
          ? row.invoiceNos
          : (row.invoiceNo ? [row.invoiceNo] : []);
        if (nos.length > 0) {
          invoiceHtml = `
            <div style="margin-top:12px;border-top:1px solid #e5e7eb;padding-top:10px;">
              <div style="font-weight:800;color:#111827;margin-bottom:6px;">Invoice No(s)</div>
              <div style="color:#374151;">${nos.filter(Boolean).join(", ")}</div>
            </div>
          `;
        }
      }
    } catch {
      // ignore invoice errors on print
    }

    const hasInvoice =
      (Array.isArray(row.invoiceIds) && row.invoiceIds.length > 0) ||
      (Array.isArray(row.invoiceNos) && row.invoiceNos.length > 0) ||
      !!(row.invoiceId || row.invoiceNo);
    const hasPaddy = (row.items || []).some(
      (it) => String(it?.itemType || "").toLowerCase() === "paddy"
    );

    const itemsTableHtml = `
      <table>
        <thead><tr><th>Item Description</th><th style="text-align:right;">Quantity</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot>
          <tr style="background:#f0fdf4;font-weight:700;">
            <td style="border:1px solid #ddd;padding:6px;">Total</td>
            <td style="border:1px solid #ddd;padding:6px;text-align:right;">${
              (row.items || []).reduce((sum, it) => sum + Number(it.quantity || 0), 0)
            }</td>
          </tr>
        </tfoot>
      </table>
    `;

    const html = `
      <html><head><title>Gate Pass ${row.gatePassNo || ""}</title>
      <style>
        @media print { @page { size: A5; margin: 10mm; } }
        body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;margin:0;padding:12mm;width:148mm;min-height:210mm;box-sizing:border-box;}
        .header{display:flex;align-items:center;border-bottom:2px solid #047857;padding-bottom:10px;margin-bottom:12px;}
        .title{font-weight:700;color:#047857;font-size:18px;line-height:1.2;}
        .addr{font-size:11px;color:#6b7280;margin-top:2px;}
        .tag{display:inline-block;margin-top:4px;padding:3px 8px;border-radius:4px;background:#d1fae5;color:#047857;font-weight:600;font-size:11px;}
        .info{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin:12px 0;}
        .info div{display:flex;justify-content:space-between;padding:4px 0;}
        .label{color:#6b7280;font-weight:500;}
        .value{color:#111;font-weight:600;}
        table{width:100%;border-collapse:collapse;margin:12px 0;font-size:11px;}
        th{background:#f0fdf4;color:#065f46;padding:6px;border:1px solid #ddd;text-align:left;}
        .remarks{display:none;}
        .footer{margin-top:20px;font-size:10px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:8px;}
      </style></head><body>
      <div class="header">
        ${logoHtml}
        <div style="flex:1;">
          <div class="title">${millName}</div>
          <div class="addr">${millAddress}</div>
          <div class="tag">INWARD GATE PASS</div>
        </div>
      </div>
      
      <div class="info">
        <div><span class="label">Gate Pass No:</span><span class="value">${
          row.gatePassNo || "-"
        }</span></div>
        <div><span class="label">Date:</span><span class="value">${
          row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-"
        }</span></div>
        <div><span class="label">Invoice No(s):</span><span class="value">${
          (Array.isArray(row.invoiceNos) && row.invoiceNos.length
            ? row.invoiceNos.filter(Boolean).join(", ")
            : (row.invoiceNo || "-"))
        }</span></div>
        <div><span class="label">Truck No:</span><span class="value">${
          row.truckNo || "-"
        }</span></div>
        <div><span class="label">Driver:</span><span class="value">${
          row.driverName || "-"
        }</span></div>
        <div><span class="label">Contact:</span><span class="value">${
          row.driverContact || "-"
        }</span></div>
      </div>

      ${hasInvoice && !hasPaddy ? "" : itemsTableHtml}

      ${invoiceHtml}

      <div class="footer">
        <div>Authorized Signature: _________________</div>
        <div style="margin-top:4px;">Printed on ${new Date().toLocaleString()}</div>
      </div>
      
      <button onclick="window.print()" style="margin-top:12px;padding:6px 10px;border:1px solid #ddd;border-radius:4px;background:#047857;color:#fff;font-size:12px;">Print</button>
      </body></html>
    `;
    win.document.write(html);
    win.document.close();
  };

  const tableColumns = [
    {
      key: "createdAt",
      label: "Date",
      render: (val) => (val ? new Date(val).toLocaleDateString() : "-"),
    },
    { key: "gatePassNo", label: "GP No" },
    { key: "supplier", label: "Company Name" },
    { key: "truckNo", label: "Truck" },
    {
      key: "items",
      label: "Items",
      render: (val, row) => {
        const list = (row.items || [])
          .map((it) => it.itemType || it.customItemName || "SMJ Own")
          .filter(Boolean);
        return list.length ? Array.from(new Set(list)).join(", ") : "-";
      },
    },
    { key: "invoiceNo", label: "Invoice No" },
    { key: "driverName", label: "Driver" },
    {
      key: "actions",
      label: "Actions",
      skipExport: true,
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => handleEdit(row)}
            className="p-1 rounded hover:bg-emerald-50"
            title="Edit"
          >
            <Edit2 className="w-4 h-4 text-emerald-600" />
          </button>
          <button
            onClick={() => handleDelete(row)}
            className="p-1 rounded hover:bg-red-50"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
          <button
            onClick={() => openPrintWindow(row)}
            className="p-1 rounded hover:bg-gray-100"
            title="Print"
          >
            <Printer className="w-4 h-4 text-gray-700" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Confirmation Dialog */}
      {confirmDialog.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {confirmDialog.title}
              </h3>
              <button
                onClick={() =>
                  setConfirmDialog({
                    open: false,
                    title: "",
                    message: "",
                    onConfirm: null,
                  })
                }
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              {confirmDialog.message}
            </p>
            {confirmDialog.expectedText && (
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">
                  Type {confirmDialog.expectedText} to confirm
                </label>
                <input
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-gray-300"
                  placeholder={confirmDialog.expectedText}
                />
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() =>
                  setConfirmDialog({
                    open: false,
                    title: "",
                    message: "",
                    onConfirm: null,
                    expectedText: "",
                  })
                }
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                disabled={
                  confirmDialog.expectedText &&
                  confirmInput !== confirmDialog.expectedText
                }
                className={`px-4 py-2 rounded-lg text-sm ${
                  confirmDialog.expectedText &&
                  confirmInput !== confirmDialog.expectedText
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Form */}
      <form
        id="gatepass-in-form"
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow p-4 space-y-4"
      >
        <h2 className="text-lg font-semibold text-emerald-700">
          Inward Gate Pass
        </h2>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Purchase Invoice */}
          <div id="field-invoiceId">
            <label className="block text-sm font-medium mb-1">
              Purchase Invoice (optional)
            </label>
            <div className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${errors.invoiceId ? "border-red-500 bg-red-50" : "border-gray-300"}`}>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filteredInvoices.map((inv) => {
                  const id = String(inv._id);
                  const checked = selectedInvoiceIds.includes(id);
                  return (
                    <label key={id} className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={checked} onChange={() => toggleInvoiceId(id)} />
                      <span className="text-xs text-gray-700">
                        {inv.invoiceNo}
                        {inv.gatePassUsed && !checked ? " (USED)" : ""}
                      </span>
                    </label>
                  );
                })}
                {filteredInvoices.length === 0 && (
                  <div className="text-xs text-gray-500">No available invoices.</div>
                )}
              </div>
            </div>
            {errors.invoiceId && (
              <p className="text-xs text-red-500 mt-1">{errors.invoiceId}</p>
            )}
          </div>

          {/* Truck No */}
          <div id="field-truckNo">
            <label className="block text-sm font-medium mb-1">
              Truck No <span className="text-red-500">*</span>
            </label>
            <input
              name="truckNo"
              value={form.truckNo}
              onChange={handleChange}
              placeholder="ABCD-1234"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                errors.truckNo ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.truckNo && (
              <p className="text-xs text-red-500 mt-1">{errors.truckNo}</p>
            )}
          </div>

          {/* Driver Name */}
          <div id="field-driverName">
            <label className="block text-sm font-medium mb-1">
              Driver Name <span className="text-red-500">*</span>
            </label>
            <input
              name="driverName"
              value={form.driverName}
              onChange={handleChange}
              placeholder="Driver name"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                errors.driverName ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.driverName && (
              <p className="text-xs text-red-500 mt-1">{errors.driverName}</p>
            )}
          </div>

          {/* Driver Contact */}
          <div id="field-driverContact">
            <label className="block text-sm font-medium mb-1">
              Driver Contact <span className="text-red-500">*</span>
            </label>
            <input
              name="driverContact"
              value={form.driverContact}
              onChange={handleChange}
              placeholder="03XX-XXXXXXX"
              maxLength={12}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                errors.driverContact ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.driverContact && (
              <p className="text-xs text-red-500 mt-1">
                {errors.driverContact}
              </p>
            )}
          </div>

          {/* Freight Charges */}
          <div id="field-freightCharges">
            <label className="block text-sm font-medium mb-1">
              Freight Charges <span className="text-red-500">*</span>
            </label>
            <input
              name="freightCharges"
              value={form.freightCharges}
              onChange={handleChange}
              placeholder="0"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                errors.freightCharges ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.freightCharges && (
              <p className="text-xs text-red-500 mt-1">{errors.freightCharges}</p>
            )}
          </div>
        </div>

        {/* Items (optional) - Paddy only */}
        <div className="border-t pt-4" id="field-paddy">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Paddy (optional)
          </h3>
          <div className="p-3 bg-gray-50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-600">
                Add one or more paddy lines (each row can have a different company
                name).
              </div>
              <button
                type="button"
                onClick={() =>
                  setItems((prev) => [
                    ...(prev || []),
                    { itemType: "Paddy", brand: "", quantity: "", unit: "kg" },
                  ])
                }
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                <Plus size={14} />
                Add
              </button>
            </div>

            <div className="grid md:grid-cols-4 gap-3 items-start">
            <div id="field-supplier">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-gray-500">
                  Company Name
                </label>
              </div>
              <select
                value={items[0]?.brand ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === OTHER_OPTION) {
                    setBrandModal({ ...createBrandModalState(), open: true });
                    return;
                  }
                  const used = (items || [])
                    .slice(1)
                    .map((x) => String(x?.brand || "").trim())
                    .filter(Boolean);
                  if (v && used.includes(v)) {
                    toast.error(
                      "Each paddy row must have a different company name."
                    );
                    return;
                  }
                  handleItemChange(0, "brand", v);
                  // Keep top-level supplier in sync for backward compatibility (printing/listing).
                  setForm((prev) => ({ ...prev, supplier: v }));
                  clearFieldError("supplier");
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                  errors.supplier ? "border-red-500 bg-red-50" : "border-gray-300"
                }`}
              >
                <option value="">Select company name</option>
                {brandOptions.map((b, idx) => (
                  <option
                    key={`${b}-${idx}`}
                    value={b}
                    disabled={(items || [])
                      .slice(1)
                      .some((x) => String(x?.brand || "").trim() === b)}
                  >
                    {b}
                  </option>
                ))}
                <option value={OTHER_OPTION}>Other (Add New)</option>
              </select>
              {errors.supplier && (
                <p className="text-xs text-red-500 mt-1">{errors.supplier}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Item</label>
              <input
                value="Paddy"
                readOnly
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-gray-300 bg-gray-100 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Quantity (no decimals)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={items[0]?.quantity ?? ""}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
                  handleItemChange(0, "quantity", v);
                }}
                placeholder="0"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-gray-300"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Unit</label>
              <select
                value={PADDY_UNITS.includes(items[0]?.unit) ? (items[0]?.unit ?? "kg") : "kg"}
                onChange={(e) => handleItemChange(0, "unit", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-gray-300"
              >
                {PADDY_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            </div>

            {(items || []).length > 1 && (
              <div className="space-y-2">
                {(items || []).slice(1).map((it, idx) => {
                  const realIdx = idx + 1;
                  return (
                    <div key={`paddy-${realIdx}`} className="grid md:grid-cols-4 gap-3 items-end">
                      <div className="md:col-span-1">
                        <label className="block text-xs text-gray-500 mb-1">
                          Company Name
                        </label>
                        <select
                          value={it?.brand ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === OTHER_OPTION) {
                              setBrandModal({ ...createBrandModalState(), open: true });
                              return;
                            }
                            const used = (items || [])
                              .map((x, i) => (i === realIdx ? "" : String(x?.brand || "").trim()))
                              .filter(Boolean);
                            if (v && used.includes(v)) {
                              toast.error(
                                "Each paddy row must have a different company name."
                              );
                              return;
                            }
                            handleItemChange(realIdx, "brand", v);
                          }}
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                            errors.supplier ? "border-red-500 bg-red-50" : "border-gray-300"
                          }`}
                        >
                          <option value="">Select company name</option>
                          {brandOptions.map((b, idx2) => (
                            <option
                              key={`${b}-${idx2}`}
                              value={b}
                              disabled={(items || [])
                                .map((x, i) => (i === realIdx ? "" : String(x?.brand || "").trim()))
                                .filter(Boolean)
                                .includes(b)}
                            >
                              {b}
                            </option>
                          ))}
                          <option value={OTHER_OPTION}>Other (Add New)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Item</label>
                        <input
                          value="Paddy"
                          readOnly
                          className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-gray-300 bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={it?.quantity ?? ""}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
                            handleItemChange(realIdx, "quantity", v);
                          }}
                          className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-gray-300"
                        />
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">Unit</label>
                          <select
                            value={PADDY_UNITS.includes(it?.unit) ? (it?.unit ?? "kg") : "kg"}
                            onChange={(e) => handleItemChange(realIdx, "unit", e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-gray-300"
                          >
                            {PADDY_UNITS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => setItems((prev) => prev.filter((_x, i) => i !== realIdx))}
                          className="px-3 py-2 rounded-lg border border-rose-200 text-rose-700 text-xs hover:bg-rose-50"
                          title="Remove line"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Invoice Items Preview */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Invoice Items (read only)
          </h3>
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            {selectedInvoiceIds.length ? (
  <ul className="list-disc pl-5 space-y-1">
    {selectedInvoiceIds
      .map((id) => purchaseInvoices.find((t) => String(t._id) === String(id)))
      .filter(Boolean)
      .flatMap((inv) => inv.items || [])
      .map(
      (it, i) => {
        const label = it.itemName || it.productTypeName || "SMJ Own";
        const qty =
          it.netWeightKg != null && it.netWeightKg !== ""
            ? String(Math.round(Number(it.netWeightKg || 0)))
            : Number(it.quantity || 0).toFixed(0);
        const unit =
          it.netWeightKg != null && it.netWeightKg !== ""
            ? "kg"
            : it.unit || "pcs";
        return (
          <li key={`inv-${i}`}>
            {label} — {qty} {unit}
          </li>
        );
      }
    )}
  </ul>
) : (
  <span>Select invoice(s) to see items.</span>
)}
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm shadow hover:bg-emerald-700"
          >
            {editingId ? "Update Gate Pass" : "Generate Gate Pass"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({
                  truckNo: "",
                  supplier: "",
                  driverName: "",
                  driverContact: "",
                  freightCharges: "",
                });
                setSelectedInvoiceId("");
                setItems([
                  { itemType: "Paddy", brand: "", quantity: "", unit: "kg" },
                ]);
                setErrors({});
              }}
              className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <DataTable
        title="Gate Pass IN"
        columns={tableColumns}
        data={rows}
        idKey="_id"
        searchPlaceholder="Search gate passes..."
        searchFormatter={formatGatePassSearch}
        emptyMessage={loading ? "Loading..." : "No gate passes found."}
        deleteAll={{
          description: "This will permanently delete ALL Gate Pass IN records from the database.",
          onConfirm: async (adminPin) => {
            const res = await api.post("/admin/purge", {
              adminPin,
              key: "gatePasses",
              filter: { type: "IN" },
            });
            const deleted = res?.data?.data?.deletedCount ?? 0;
            toast.success(`Deleted ${deleted} Gate Pass IN records`);
            fetchRows();
          },
        }}
      />

      <AddOptionModal
        open={brandModal.open}
        title="Manage Company Names"
        subtitle="Add brand, select products, set conversion and pricing."
        maxWidthClass="max-w-[20cm]"
        onClose={() => setBrandModal(createBrandModalState())}
        onSubmit={saveBrandFromModal}
        submitLabel="Add"
        loading={brandModal.saving}
      >
        <div className="space-y-4">
          <div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs text-gray-600 mb-1">
                  Company Name *
                </label>
                {brandModal.value !== OTHER_OPTION ? (
                  <select
                    className={`w-full border rounded px-3 py-2 text-sm ${
                      brandModal.errors?.value ? "border-red-400 bg-red-50" : "border-gray-300"
                    }`}
                    value={brandModal.value}
                    onChange={(e) =>
                      setBrandModal((prev) => {
                        const nextValue = e.target.value;
                        const nextBrandName =
                          nextValue === OTHER_OPTION ? prev.valueOther : nextValue;
                        return {
                          ...prev,
                          value: nextValue,
                          valueOther: nextValue === OTHER_OPTION ? prev.valueOther : "",
                          productRows:
                            nextValue && nextValue !== OTHER_OPTION
                              ? getBrandProducts(nextValue)
                              : prev.productRows,
                          draft: {
                            ...(prev.draft || {}),
                            nameSelect: "",
                            nameOther: "",
                          },
                          errors: {
                            ...(prev.errors || {}),
                            value: validateBrandValue(nextBrandName),
                            rowsGeneral: "",
                          },
                        };
                      })
                    }
                  >
                    <option value="">Select company name</option>
                    {brandOptions.map((b, idx) => (
                      <option key={`brand-opt-${b}-${idx}`} value={b}>
                        {b}
                      </option>
                    ))}
                    <option value={OTHER_OPTION}>Other</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className={`w-full border rounded px-3 py-2 text-sm ${
                        brandModal.errors?.value ? "border-red-400 bg-red-50" : "border-gray-300"
                      }`}
                      value={brandModal.valueOther || ""}
                      onChange={(e) =>
                        setBrandModal((prev) => {
                          const next = sanitizeBrandText(e.target.value, 100);
                          const match = (brandOptions || []).find(
                            (b) => normalizeText(b) === normalizeText(next)
                          );
                          if (match) {
                            return {
                              ...prev,
                              value: match,
                              valueOther: "",
                              productRows: getBrandProducts(match),
                            errors: {
                              ...(prev.errors || {}),
                              value: "Company Name already exists.",
                            },
                            };
                          }
                          return {
                            ...prev,
                            valueOther: next,
                            errors: { ...(prev.errors || {}), value: validateBrandValue(next) },
                          };
                        })
                      }
                      onBlur={() =>
                        setBrandModal((prev) => ({
                          ...prev,
                          valueOther: toTitleCase(prev.valueOther || ""),
                        }))
                      }
                      placeholder="Enter company name"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setBrandModal((prev) => ({
                          ...prev,
                          value: "",
                          valueOther: "",
                          errors: { ...(prev.errors || {}), value: "" },
                        }))
                      }
                      className="px-3 py-2 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      List
                    </button>
                  </div>
                )}
                {brandModal.errors?.value ? (
                  <p className="mt-1 text-xs text-red-500">{brandModal.errors.value}</p>
                ) : null}
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs text-gray-600 mb-1">Product Name *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className={`w-full border rounded px-3 py-2 text-sm ${
                      brandModal.errors?.draft?.name ? "border-red-400 bg-red-50" : "border-gray-300"
                    }`}
                    value={brandModal.draft?.nameOther || ""}
                    onChange={(e) => handleBrandDraftChange("nameOther", e.target.value)}
                    onBlur={() =>
                      setBrandModal((prev) => ({
                        ...prev,
                        draft: {
                          ...(prev.draft || {}),
                          nameOther: toTitleCase(prev.draft?.nameOther || ""),
                        },
                      }))
                    }
                    placeholder="Enter product name"
                  />
                  <button
                    type="button"
                    onClick={() => handleBrandDraftChange("toggleProductList")}
                    className="px-3 py-2 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    List
                  </button>
                </div>
                {brandModal.draft?.showList && (
                  <select
                    className="w-full border rounded px-3 py-2 text-sm mt-2"
                    value=""
                    onChange={(e) => handleBrandDraftChange("nameOther", e.target.value)}
                  >
                    <option value="">Select product</option>
                    {productNameOptions.map((name, idx) => (
                      <option key={`brand-template-${name}-${idx}`} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs text-gray-600 mb-1">Base Unit</label>
                <input
                  type="text"
                  value="KG"
                  readOnly
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100 text-gray-600"
                />
              </div>

              <div className="col-span-12 md:col-span-9">
                <label className="block text-xs text-gray-600 mb-1">Processing Pricing per KG (PKR) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className={`w-full border rounded px-3 py-2 text-sm ${
                    brandModal.errors?.draft?.pricePerKg ? "border-red-400 bg-red-50" : "border-gray-300"
                  }`}
                  value={brandModal.draft?.pricePerKg || ""}
                  onChange={(e) =>
                    setBrandModal((prev) => {
                      const pricePerKg = sanitizeIntegerText(e.target.value, 8);
                      return {
                        ...prev,
                        draft: {
                          ...(prev.draft || {}),
                          pricePerKg,
                        },
                        errors: { ...(prev.errors || {}), draft: {} },
                      };
                    })
                  }
                  placeholder="Required"
                />
              </div>

              <div className="col-span-12">
                <label className="block text-xs text-gray-600 mb-1">
                  Conversion Factor (1 unit = ? KG) - editable
                </label>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span>1 Bag =</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={`w-24 border rounded px-2 py-1 ${
                      brandModal.errors?.draft?.bagKg ? "border-red-400 bg-red-50" : "border-gray-300"
                    }`}
                    value={brandModal.draft?.bagKg || ""}
                    onChange={(e) => handleBrandDraftChange("bagKg", e.target.value)}
                  />
                  <span>KG</span>
                  <span>1 Ton =</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={`w-24 border rounded px-2 py-1 ${
                      brandModal.errors?.draft?.tonKg ? "border-red-400 bg-red-50" : "border-gray-300"
                    }`}
                    value={brandModal.draft?.tonKg || ""}
                    onChange={(e) => handleBrandDraftChange("tonKg", e.target.value)}
                  />
                  <span>KG</span>
                  <button
                    type="button"
                    onClick={addDraftProductRow}
                    className="ml-auto px-3 py-2 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    + Add Product
                  </button>
                </div>
                {Object.values(brandModal.errors?.draft || {}).length > 0 ? (
                  <p className="mt-1 text-xs text-red-500">Please fill all required product fields.</p>
                ) : null}
              </div>
            </div>
          </div>
          <div>
            <div className="rounded border border-gray-200 p-2 min-h-[44px]">
              {(brandModal.productRows || []).length === 0 ? (
                <div className="text-xs text-gray-400">No products added yet.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(brandModal.productRows || []).map((row, idx) => (
                    <div key={`brand-product-pill-${idx}`} className="inline-flex items-center px-2 py-1 rounded bg-emerald-100 text-emerald-800 text-xs">
                      <span>{row.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {brandModal.errors?.rowsGeneral ? (
              <p className="mt-1 text-xs text-red-500">{brandModal.errors.rowsGeneral}</p>
            ) : null}
          </div>
        </div>
      </AddOptionModal>
    </div>
  );
}



