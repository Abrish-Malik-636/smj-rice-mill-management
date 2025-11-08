// backend/controllers/dashboardController.js
const Company = require("../models/companyModel");
const ProductType = require("../models/productTypeModel");

const getDashboardStats = async (req, res) => {
  try {
    // You can extend this later with financial and stock modules
    const totalCompanies = await Company.countDocuments();
    const totalProducts = await ProductType.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        totalCompanies,
        totalProducts,
        totalExpenses: 12, // placeholder
        pendingPayments: 5, // placeholder
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard data",
      error: error.message,
    });
  }
};

module.exports = { getDashboardStats };
