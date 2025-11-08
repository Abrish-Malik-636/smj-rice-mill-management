const ProductType = require("../models/productTypeModel");

// Get all product types
exports.getProductTypes = async (req, res) => {
  try {
    const productTypes = await ProductType.find();
    res.json({ success: true, data: productTypes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create new product type
exports.createProductType = async (req, res) => {
  try {
    const productType = await ProductType.create(req.body);
    res.status(201).json({ success: true, data: productType });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete product type
exports.deleteProductType = async (req, res) => {
  try {
    const productType = await ProductType.findByIdAndDelete(req.params.id);
    if (!productType)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Product type deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// Edit Product type
exports.updateProductType = async (req, res) => {
  try {
    const updated = await ProductType.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
