"""Month helpers. Months are 'YYYY-MM' strings everywhere in the API."""

from datetime import date


def month_range(month: str) -> tuple[date, date]:
    """'2026-10' -> (2026-10-01, 2026-11-01), end exclusive."""
    year, mon = (int(p) for p in month.split("-"))
    start = date(year, mon, 1)
    end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    return start, end


def shift_month(month: str, delta: int) -> str:
    """shift_month('2026-01', -1) -> '2025-12'."""
    year, mon = (int(p) for p in month.split("-"))
    idx = year * 12 + (mon - 1) + delta
    return f"{idx // 12:04d}-{idx % 12 + 1:02d}"


def current_month() -> str:
    return date.today().strftime("%Y-%m")
