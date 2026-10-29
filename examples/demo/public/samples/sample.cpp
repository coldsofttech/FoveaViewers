// A small program to try the code viewer on.
#include <iostream>
#include <string>
#include <vector>

#define MAX_ITEMS 8

namespace shop {

/* An item for sale.
   Its price is in pence. */
struct Item {
  std::string name;
  int price = 0;
};

template <typename T>
T total(const std::vector<T>& items) {
  T sum{};
  for (const auto& item : items) sum += item.price;
  return sum;
}

}  // namespace shop

int main() {
  std::vector<shop::Item> basket = {{"tea", 350}, {"milk", 120}};
  if (basket.size() > MAX_ITEMS) return 1;
  std::cout << "Items: " << basket.size() << '\n';
  return 0;
}
