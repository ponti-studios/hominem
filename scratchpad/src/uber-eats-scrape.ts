type Order = {
	restaurant: string;
	numOfItems: number;
	price: string;
	date: string;
};

function scrapeUberEatsOrders() {
	const orders = Array.from(document.querySelectorAll(".sh"));
	const result: {
		total: number;
		restaurants: { [key: string]: { visits: number; total: number } };
		orders: Order[];
	} = {
		// Total amount spent on Uber Eats
		total: 0,
		// Per-restaurant info
		restaurants: {},
		// The order information
		orders: [],
	};

	for (const order of orders) {
		const node = Array.from(order.querySelectorAll(".ls"));

		if (!node[1]) {
			continue;
		}

		const info = node[1].textContent
			?.split("•")
			.map((s) => s.trim())
			.slice(0, 2);

		const restaurantLinks = Array.from(
			order.querySelectorAll('a[data-baseweb="link"]'),
		);
		const restaurant = restaurantLinks.filter(
			(o: Element) => (o as HTMLAnchorElement).href.indexOf("/store") >= 0,
		)[0].textContent;

		if (!info || !restaurant) {
			continue;
		}

		const itemsAndPrice = info[0].split(" items for ");
		const numOfItems = Number(itemsAndPrice[0]);
		const price = Number.parseFloat(itemsAndPrice[1].slice(1));

		// 1. Add price to result total
		result.total += price;

		// 2. Add or update the restaurant
		if (result.restaurants[restaurant]) {
			result.restaurants[restaurant].visits += 1;
			result.restaurants[restaurant].total += price;
		} else {
			result.restaurants[restaurant] = { visits: 1, total: price };
		}

		// 3. Add order to the orders
		result.orders.push({
			restaurant,
			numOfItems,
			price: itemsAndPrice[1],
			date: info[1],
		});
	}
}
