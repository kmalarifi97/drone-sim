"""Crash diagnosis ruleset.

Input: a dict-like with combined config + telemetry fields.
Output: (cause, concept_tag, explanation).

Rules evaluated in order; FIRST match wins. The success fallback is last.
"""
from typing import Tuple, Optional

from .schemas import DroneConfigIn, TelemetryIn


def derive_inputs(config: DroneConfigIn, telemetry: TelemetryIn) -> dict:
    total_weight_g = config.totalMass + config.payloadMass
    max_thrust_g = config.motorCount * config.motorMaxThrust
    twr = max_thrust_g / total_weight_g if total_weight_g > 0 else 0.0
    # v0: no per-axis distinction between lateral and vertical TWR.
    lateral_twr = twr
    cells = max(1, config.batteryCells)
    cell_nominal_v = config.batteryVoltage / cells
    # Approximation: linear scale of nominal cell voltage by state-of-charge.
    soc = (
        telemetry.battery_remaining_mah / config.batteryCapacityMah
        if config.batteryCapacityMah > 0
        else 0.0
    )
    min_cell_voltage_v = cell_nominal_v * soc
    hover_throttle_pct = (1.0 / twr) * 100.0 if twr > 0 else float("inf")
    # Approximation: ignores non-linearity of motor thrust with voltage / RPM.
    static_thrust_at_voltage_g = max_thrust_g

    return {
        "twr": twr,
        "lateral_twr": lateral_twr,
        "min_cell_voltage_v": min_cell_voltage_v,
        "hover_throttle_pct": hover_throttle_pct,
        "static_thrust_at_voltage_g": static_thrust_at_voltage_g,
        "total_weight_g": total_weight_g,
    }


def diagnose(
    config: DroneConfigIn, telemetry: TelemetryIn
) -> Tuple[str, Optional[str], str, dict]:
    d = derive_inputs(config, telemetry)
    twr = d["twr"]
    lateral_twr = d["lateral_twr"]
    min_cell_voltage_v = d["min_cell_voltage_v"]
    hover_throttle_pct = d["hover_throttle_pct"]
    static_thrust_at_voltage_g = d["static_thrust_at_voltage_g"]
    total_weight_g = d["total_weight_g"]

    # 1. insufficient_climb_rate
    if telemetry.collided_with_obstacle and twr < 1.5:
        return (
            "insufficient_climb_rate",
            "thrust_to_weight",
            f"Drone TWR was {twr:.2f}; you need at least 1.5 to climb fast enough to clear obstacles.",
            d,
        )

    # 2. battery_depleted
    if min_cell_voltage_v < 3.3 and telemetry.outcome != "success":
        return (
            "battery_depleted",
            "energy_budget",
            f"Estimated minimum cell voltage was {min_cell_voltage_v:.2f}V (below 3.3V safe threshold). The battery couldn't last the full mission.",
            d,
        )

    # 3. esc_overcurrent
    if telemetry.peak_current_a > telemetry.esc_current_rating_a:
        return (
            "esc_overcurrent",
            "esc_sizing",
            f"Peak current was {telemetry.peak_current_a:.1f}A but the ESC is only rated for {telemetry.esc_current_rating_a:.1f}A; the ESC would have overheated or failed.",
            d,
        )

    # 4. wind_drift
    if telemetry.peak_drift_m > 10 and lateral_twr < 2.0:
        return (
            "wind_drift",
            "control_authority",
            f"Peak lateral drift was {telemetry.peak_drift_m:.1f}m with lateral TWR of {lateral_twr:.2f} (need >2.0). The drone lacked control authority to hold the path against wind.",
            d,
        )

    # 5. payload_too_heavy
    if hover_throttle_pct > 75:
        return (
            "payload_too_heavy",
            "payload_capacity",
            f"Hover throttle was {hover_throttle_pct:.1f}% (over the 75% safe ceiling). With this much payload the drone has no headroom to maneuver.",
            d,
        )

    # 6. prop_mismatch
    if static_thrust_at_voltage_g < total_weight_g:
        return (
            "prop_mismatch",
            "prop_selection",
            f"Static thrust at the chosen voltage is {static_thrust_at_voltage_g:.0f}g but total weight is {total_weight_g:.0f}g; the props can't lift the drone.",
            d,
        )

    # 7. success fallback
    if telemetry.outcome == "success":
        return (
            "success",
            None,
            f"Mission completed in {telemetry.elapsed_seconds:.1f}s with {telemetry.battery_remaining_mah:.0f}mAh remaining.",
            d,
        )

    # No specific failure rule matched but outcome was not success — give a generic message.
    return (
        "unknown",
        None,
        f"Mission failed (sim reason: {telemetry.crash_reason_from_sim or 'unspecified'}) but no specific engineering rule matched. TWR={twr:.2f}, hover={hover_throttle_pct:.1f}%.",
        d,
    )
