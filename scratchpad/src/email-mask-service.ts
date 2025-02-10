import { v4 as uuidV4 } from "uuid";

interface EmailAddress {
	id: string; // Internal ID for tracking
	uuidEmail: string;
	userId: string; // ID of the user owning this address
	isActive: boolean;
}

class EmailAddressManager {
	private emailAddresses: EmailAddress[] = [];
	private emailDomain: string; //  e.g., "example.com", MUST BE CONFIGURED

	constructor(emailDomain: string) {
		this.emailDomain = emailDomain;
		if (!this.emailDomain) {
			throw new Error("Email domain must be provided.");
		}
	}

	generateEmailAddress(userId: string): EmailAddress {
		const uuid = uuidV4();
		const newEmail: EmailAddress = {
			id: uuidV4(), //Internal ID for our system
			uuidEmail: `${uuid}@${this.emailDomain}`,
			userId: userId,
			isActive: true,
		};
		this.emailAddresses.push(newEmail);
		return newEmail;
	}

	deactivateEmailAddress(id: string): boolean {
		const index = this.emailAddresses.findIndex((email) => email.id === id);
		if (index === -1) {
			return false; // Email address not found
		}
		this.emailAddresses[index].isActive = false;
		return true;
	}

	getEmailAddressById(id: string): EmailAddress | undefined {
		return this.emailAddresses.find((email) => email.id === id);
	}

	getEmailAddressesByUserId(userId: string): EmailAddress[] {
		return this.emailAddresses.filter(
			(email) => email.userId === userId && email.isActive,
		);
	}

	// ... other methods for managing email addresses (e.g., listing all active addresses, etc.)
}

// Example Usage:
const emailManager = new EmailAddressManager("myapp.example.com"); // Replace with your domain

const userId1 = "user123";
const email1 = emailManager.generateEmailAddress(userId1);
console.log("Generated email:", email1);

const email2 = emailManager.generateEmailAddress(userId1);
console.log("Generated email:", email2);

const emailsForUser1 = emailManager.getEmailAddressesByUserId(userId1);
console.log("Emails for user1:", emailsForUser1);

emailManager.deactivateEmailAddress(email1.id);
const emailsForUser1AfterDeactivation =
	emailManager.getEmailAddressesByUserId(userId1);
console.log(
	"Emails for user1 after deactivation:",
	emailsForUser1AfterDeactivation,
);

//Error Handling Example
// const badEmailManager = new EmailAddressManager(""); // This will throw an error
