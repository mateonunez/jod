import { z } from "zod";
import { choice, noul, score, semantics } from "../src/index.ts";

if (!process.env.TYPESAFE_API_KEY) {
  console.error("Set TYPESAFE_API_KEY first, then rerun.");
  console.error("Keys live at https://console.typesafe.ai/settings/keys");
  process.exit(1);
}

const Ticket = z.object({ message: z.string() });

const triage = semantics({
  state: Ticket,
  ask: {
    department: choice("Which team should handle `message`?", {
      billing: "Charges, invoices, refunds, or subscriptions",
      technical: "Bugs, integrations, or outages",
      account: "Login, profile, permissions, or security",
    }),
    refundRequested: noul("Does `message` explicitly ask for money back or an account credit?"),
    frustration: score("How frustrated does the customer appear in `message`?", [
      "Calm and matter-of-fact",
      "Frustrated but civil",
      "Very angry, or threatening to leave",
    ]),
  },
});

const result = await triage.ask({
  message:
    "Our API integration has been returning 500s for 20 minutes and we can't process any orders.",
});

console.log(JSON.stringify(result, null, 2));
