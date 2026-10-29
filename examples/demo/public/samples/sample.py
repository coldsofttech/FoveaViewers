"""A small module to try the code viewer on."""

from dataclasses import dataclass
import json

MAX_ITEMS = 100  # the most a basket can hold


@dataclass
class Item:
    name: str
    price: float = 0.0

    def label(self) -> str:
        return f"{self.name}: {self.price:.2f}"


def total(items: list[Item]) -> float:
    '''Add up the prices.'''
    if not items:
        return 0.0
    return sum(item.price for item in items[:MAX_ITEMS])


if __name__ == "__main__":
    basket = [Item("tea", 3.5), Item("milk", 1.2)]
    print(json.dumps({"total": total(basket), "count": len(basket)}))
