// backend/controllers/dashboardController.js
const Company = require("../models/companyModel");
const ProductType = require("../models/productTypeModel");
const ProductionBatch = require("../models/productionBatchModel");

const getDashboardStats = async (req, res) => {
  try {
    // Today range (server local time)
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    const [totalCompanies, totalProducts, todayBatches] = await Promise.all([
      Company.countDocuments(),
      ProductType.countDocuments(),
      ProductionBatch.find({
        date: { $gte: startOfDay, $lte: endOfDay },
      })
        .select("paddyWeightKg totalOutputWeightKg")
        .lean(),
    ]);

    let todayTotalPaddyKg = 0;
    let todayTotalOutputKg = 0;

    todayBatches.forEach((b) => {
      todayTotalPaddyKg += Number(b.paddyWeightKg || 0);
      todayTotalOutputKg += Number(b.totalOutputWeightKg || 0);
    });

    res.status(200).json({
      success: true,
      data: {
        totalCompanies,
        totalProducts,

        // Real-time from production
        todayTotalPaddyKg, // used for "Bags Inward"
        todayTotalOutputKg, // used for "Bags Outward"

        // Placeholders for finance module (to be wired later)
        totalExpenses: 0,
        pendingPayments: 0,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard data",
      error: error.message,
    });
  }
};

module.exports = { getDashboardStats };
