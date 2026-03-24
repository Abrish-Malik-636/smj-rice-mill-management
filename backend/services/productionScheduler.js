const ProductionBatch = require("../models/productionBatchModel");
const StockLedger = require("../models/stockLedgerModel");
const SystemAction = require("../models/systemActionModel");

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

      // Accounting integration intentionally removed: accounting is manual-entry only.
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

      // If batch just completed, create a pending decision for remaining paddy (if any).
      if (allDone) {
        try {
          const raw = Number(batch.paddyWeightKg || 0) || 0;
          // Don't rely on stored aggregates (may be stale). Compute from outputs.
          const outKg = (batch.outputs || [])
            .filter((o) => (o.status || "COMPLETED") === "COMPLETED")
            .reduce((sum, o) => sum + (Number(o.netWeightKg) || 0), 0);

          // Keep aggregates consistent for UI/other endpoints.
          batch.totalRawWeightKg = +raw.toFixed(3);
          batch.totalOutputWeightKg = +outKg.toFixed(3);
          batch.dayShiftOutputWeightKg = +(batch.outputs || [])
            .filter((o) => (o.status || "COMPLETED") === "COMPLETED" && o.shift === "DAY")
            .reduce((sum, o) => sum + (Number(o.netWeightKg) || 0), 0)
            .toFixed(3);
          batch.nightShiftOutputWeightKg = +(batch.outputs || [])
            .filter((o) => (o.status || "COMPLETED") === "COMPLETED" && o.shift === "NIGHT")
            .reduce((sum, o) => sum + (Number(o.netWeightKg) || 0), 0)
            .toFixed(3);
          await batch.save();
          const remaining = Math.max(0, +(raw - outKg).toFixed(3));
          if (remaining > 0) {
            const exists = await SystemAction.findOne({
              type: "PADDY_REMAINING_DECISION",
              status: "PENDING",
              batchId: batch._id,
            }).lean();
            if (!exists) {
              await SystemAction.create({
                type: "PADDY_REMAINING_DECISION",
                status: "PENDING",
                batchId: batch._id,
                batchNo: batch.batchNo,
                brandName: String(batch.sourceCompanyName || "").trim(),
                remainingPaddyKg: remaining,
              });
            }
          }
        } catch (e) {
          console.error("productionScheduler remaining paddy action error:", e?.message || e);
        }
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
