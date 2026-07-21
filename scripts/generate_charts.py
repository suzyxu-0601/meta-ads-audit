#!/usr/bin/env python3
"""Renders the 3 slide-1 charts as transparent PNGs so they can be embedded
directly into a dark PowerPoint slide. Usage:

    generate_charts.py <input.json> <output_dir>

input.json: {"monthly": [{"monthLabel": "Jan 2026", "spend": 1234.5,
             "cpm": 12.3, "frequency": 2.1, "roas": 3.4, "cpa": 20.1}, ...]}
"""
import json
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

GR0_BLUE = "#0163C3"
GR0_ORANGE = "#F86120"
TEXT_COLOR = "#E6E6E6"
GRID_COLOR = "#3A4260"

plt.rcParams.update({
    "text.color": TEXT_COLOR,
    "axes.edgecolor": GRID_COLOR,
    "axes.labelcolor": TEXT_COLOR,
    "xtick.color": TEXT_COLOR,
    "ytick.color": TEXT_COLOR,
    "font.size": 13,
    "font.family": "sans-serif",
})


def style_transparent(fig, ax):
    fig.patch.set_alpha(0)
    ax.patch.set_alpha(0)
    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)
    for spine in ["left", "bottom"]:
        ax.spines[spine].set_color(GRID_COLOR)


def money_formatter(x, _pos):
    if abs(x) >= 1000:
        return f"${x / 1000:.0f}K"
    return f"${x:.0f}"


def spend_chart(monthly, out_path):
    fig, ax = plt.subplots(figsize=(6.2, 3.4), dpi=200)
    labels = [m["monthShort"] for m in monthly]
    spend = [m["spend"] for m in monthly]
    colors = [GR0_ORANGE if i == len(spend) - 1 else GR0_BLUE for i in range(len(spend))]

    ax.bar(labels, spend, color=colors, width=0.6)
    ax.yaxis.set_major_formatter(FuncFormatter(money_formatter))
    ax.grid(axis="y", color=GRID_COLOR, linewidth=0.6, alpha=0.5)
    ax.set_axisbelow(True)
    ax.set_ylabel("Spend")
    style_transparent(fig, ax)
    fig.tight_layout()
    fig.savefig(out_path, transparent=True)
    plt.close(fig)


def dual_axis_chart(monthly, left_key, right_key, left_label, right_label, out_path):
    fig, ax_left = plt.subplots(figsize=(6.2, 3.4), dpi=200)
    labels = [m["monthShort"] for m in monthly]
    left_vals = [m[left_key] for m in monthly]
    right_vals = [m[right_key] for m in monthly]

    ax_left.plot(labels, left_vals, color=GR0_BLUE, marker="o", linewidth=2.2, label=left_label)
    ax_left.set_ylabel(left_label, color=GR0_BLUE)
    ax_left.tick_params(axis="y", colors=GR0_BLUE)

    ax_right = ax_left.twinx()
    ax_right.plot(labels, right_vals, color=GR0_ORANGE, marker="o", linewidth=2.2, label=right_label)
    ax_right.set_ylabel(right_label, color=GR0_ORANGE)
    ax_right.tick_params(axis="y", colors=GR0_ORANGE)
    ax_right.spines["top"].set_visible(False)

    ax_left.grid(axis="y", color=GRID_COLOR, linewidth=0.6, alpha=0.4)
    ax_left.set_axisbelow(True)
    style_transparent(fig, ax_left)
    ax_right.patch.set_alpha(0)

    fig.tight_layout()
    fig.savefig(out_path, transparent=True)
    plt.close(fig)


def main():
    input_path, output_dir = sys.argv[1], sys.argv[2]
    with open(input_path) as f:
        payload = json.load(f)

    monthly = payload["monthly"]
    if not monthly:
        raise ValueError("monthly array is empty — nothing to chart")

    spend_chart(monthly, f"{output_dir}/chart_spend.png")
    dual_axis_chart(monthly, "roas", "cpa", "ROAS", "CPA ($)", f"{output_dir}/chart_roas_cpa.png")
    dual_axis_chart(monthly, "cpm", "frequency", "CPM ($)", "Frequency", f"{output_dir}/chart_cpm_freq.png")
    print("charts written")


if __name__ == "__main__":
    main()
