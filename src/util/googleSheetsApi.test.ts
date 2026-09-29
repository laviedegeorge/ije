import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appendRowsToSheet, isSheetsConfigured, readSheetValues } from "@/util/googleSheetsApi";

const URL = "https://script.google.com/macros/s/fake/exec";

const reply = (body: string, status = 200) =>
	vi.fn().mockResolvedValue(new Response(body, { status }));

beforeEach(() => {
	vi.stubEnv("APPS_SCRIPT_URL", URL);
	vi.stubEnv("APPS_SCRIPT_SECRET", "s3cret");
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("Apps Script client", () => {
	it("is not configured without both the URL and the secret", () => {
		expect(isSheetsConfigured()).toBe(true);
		vi.stubEnv("APPS_SCRIPT_SECRET", "");
		expect(isSheetsConfigured()).toBe(false);
	});

	it("posts appends as JSON with the secret", async () => {
		const fetch = reply('{"ok":true}');
		vi.stubGlobal("fetch", fetch);

		const result = await appendRowsToSheet("RSVPs", [["a", "b"]], { headers: ["A", "B"] });

		expect(result).toEqual({ ok: true });
		const [url, init] = fetch.mock.calls[0];
		expect(url).toBe(URL);
		expect(JSON.parse(init.body)).toEqual({
			secret: "s3cret",
			action: "append",
			sheet: "RSVPs",
			rows: [["a", "b"]],
			headers: ["A", "B"],
		});
	});

	it("returns the values of a read", async () => {
		vi.stubGlobal("fetch", reply('{"ok":true,"values":[["Name"],["Ada Obi"]]}'));
		expect(await readSheetValues("Invites")).toEqual({ ok: true, values: [["Name"], ["Ada Obi"]] });
	});

	it("treats script errors as upstream failures", async () => {
		vi.stubGlobal("fetch", reply('{"ok":false,"error":"unauthorized"}'));
		expect(await appendRowsToSheet("RSVPs", [["a"]])).toEqual({ ok: false, reason: "upstream" });
	});

	it("treats an HTML error page as an upstream failure", async () => {
		vi.stubGlobal("fetch", reply("<html>Script function not found</html>"));
		expect(await readSheetValues("Invites")).toEqual({ ok: false, reason: "upstream" });
	});

	it("treats network failures as upstream failures", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
		expect(await appendRowsToSheet("RSVPs", [["a"]])).toEqual({ ok: false, reason: "upstream" });
	});

	it("does not call out when not configured", async () => {
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		vi.stubEnv("APPS_SCRIPT_URL", "");
		expect(await appendRowsToSheet("RSVPs", [["a"]])).toEqual({ ok: false, reason: "not_configured" });
		expect(fetch).not.toHaveBeenCalled();
	});
});
