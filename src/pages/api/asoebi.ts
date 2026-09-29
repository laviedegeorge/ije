import { event } from "@/config/event";
import { createInterestHandler } from "@/util/interestApi";

export const prerender = false;

export const POST = createInterestHandler({ list: "asoebi", sheetName: event.sheets.asoebi });
