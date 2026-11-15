"""Rule-based auto-categorisation for imported bank transactions.

A rule is: transaction kind, the category name it maps to, and keywords looked for in the
bank's description. The first rule that matches wins. No match leaves the transaction
uncategorised, and the user can set the category by hand afterwards.
"""

from app.models import Category, TxKind

RULES: list[tuple[TxKind, str, tuple[str, ...]]] = [
    (TxKind.income, "Salary", ("nomina", "nómina", "salary", "payroll")),
    (TxKind.income, "Scholarship", ("beca", "scholarship")),
    (TxKind.expense, "Rent", ("alquiler", "rent ")),
    (TxKind.expense, "Groceries", ("mercadona", "lidl", "carrefour", "aldi", "alcampo", "eroski", "supermercado")),
    (TxKind.expense, "Subscriptions", ("netflix", "spotify", "hbo", "disney", "amazon prime", "icloud")),
    (TxKind.expense, "Transport", ("renfe", "uber", "cabify", "bolt", "metro", "taxi", "repsol", "cepsa")),
    (TxKind.expense, "Eating out", ("glovo", "just eat", "restaurante", "burger", "mcdonald", "telepizza", "starbucks")),
    (TxKind.expense, "Travel", ("ryanair", "vueling", "iberia", "booking.com", "airbnb")),
    (TxKind.expense, "Leisure", ("cinesa", "steam", "playstation", "fnac", "ticketmaster")),
    (TxKind.expense, "Health", ("farmacia", "clinica", "clínica", "dentista", "hospital")),
    (TxKind.expense, "Education", ("universidad", "matricula", "matrícula", "libreria", "librería", "udemy")),
]


def guess_category_id(description: str, kind: TxKind, categories: list[Category]) -> int | None:
    """Id of the user's category that fits the description, or None. `categories` are the user's own."""
    text = f"{description.lower()} "
    by_name = {(c.name, c.kind): c.id for c in categories}
    for rule_kind, name, keywords in RULES:
        if rule_kind == kind and any(k in text for k in keywords):
            return by_name.get((name, kind))
    return None
