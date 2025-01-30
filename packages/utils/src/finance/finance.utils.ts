import type { Company } from "../db/schema/company.schema";
import type { Person } from "../types/people";

interface ItemCategory {
	id: number;
	name: string;
	userId: number;
	parentId: number | null;
}

interface Item {
	name: string;
	date_acquired: Date;
	date_sold: Date | null;
	brand: Company;
	category: ItemCategory;
	sub_category?: ItemCategory;
	purchase_price: number;
	sale_price: number | null;
	url: string | null;
	color: string | null;
	image_url: string | null;
	model_name: string | null;
	model_number: string | null;
	serial_number: string | null;
	notes: string | null;
	size: string | null;
	from: Person;
}

/**
 * # Cost per Time
 *
 * ## Description
 * Determine how much an item costs of a user's time in minutes, hours, days, and years.
 *
 * ## Steps
 *  1. Create a User class
 *  2. Get user’s annual salary
 *  3. Get price of item
 *  4. Determine user’s hourly rate
 *  5. Determine how many minutes of a user's time it times to afford item
 *  6. Determine how many hours of a user's time it times to afford item
 *  7. Determine how many days of a user's time it times to afford item
 *  8. Determine how many years of a user's time it times to afford item
 */
export function calculateCostPerDay(item: Item): number {
	return +(item.purchase_price / 3 / 365).toPrecision(4);
}
