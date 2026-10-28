import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { createResponsesTurn, ProviderRequestError, type ProviderTurnInput, type ProviderTurnResult } from "../lib/ai/provider-protocol";
import { AI_TOOL_CATALOG, AI_TOOL_NAMES, type AiToolName } from "../lib/ai/tool-catalog";

const id = "11111111-1111-4111-8111-111111111111";
const model = { id: "deterministic-fixture", contextTokens: 16000, outputTokens: 8192, functionCalls: true as const, strictSchemas: true as const, usage: true as const };
const request = (names: AiToolName[] = ["list_contacts"]) => ({ model: { ...model }, maxOutputTokens: 4096, toolNames: names, history: [{ kind: "user" as const, text: "Find the supplier and prepare a draft. Amounts are explicitly IRR minor units." }] });
const usage = { input_tokens: 100, output_tokens: 20, total_tokens: 120, input_tokens_details: { cached_tokens: 10 }, output_tokens_details: { reasoning_tokens: 0 } };
const call = (name = "list_contacts", args = '{"page":null,"limit":null,"search":"Supplier","type":null}', callId = "call_1", itemId = "fc_1") => ({ id: itemId, type: "function_call", status: "completed", call_id: callId, name, arguments: args });
const message = (text = "Draft prepared. Inspect its confirmed server receipt.") => ({ id: "msg_1", type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text, annotations: [] }] });
const response = (output: unknown[] = [call()]) => ({ model: model.id, status: "completed", error: null, incomplete_details: null, output, usage: structuredClone(usage) });
function invalid(result: ProviderTurnResult, code?: string) {
  assert.equal(result.status, "invalid");
  if (result.status !== "invalid") assert.fail("Expected invalid response");
  if (code) assert.equal(result.code, code);
  assert.equal("calls" in result, false); assert.equal("untrustedText" in result, false);
  return result;
}
function validCall(result: ProviderTurnResult) {
  assert.equal(result.status, "valid");
  if (result.status !== "valid" || result.finish !== "tool_calls") assert.fail("Expected complete validated call");
  return result.calls[0];
}
function badRequest(input: unknown) {
  assert.throws(() => createResponsesTurn(input as ProviderTurnInput), error => {
    assert.ok(error instanceof ProviderRequestError); assert.equal(error.message, "Invalid or unsupported provider request");
    assert.doesNotMatch(error.message, /PRIVATE|SECRET|password|token/i); return true;
  });
}

test("stateless request binds server model, serial strict functions, immutable ceilings and no caller options", () => {
  const input = request(), turn = createResponsesTurn(input);
  assert.equal(turn.request.model, model.id); assert.equal(turn.request.store, false); assert.equal(turn.request.stream, false);
  assert.equal(turn.request.parallel_tool_calls, false); assert.equal(turn.request.max_output_tokens, 4096);
  assert.equal(turn.requestBytes, Buffer.byteLength(JSON.stringify(turn.request)));
  assert.deepEqual(turn.reservation, { inputCeiling: "11904", outputCeiling: "4096" });
  assert.equal(turn.request.tools[0].strict, true);
  assert.match(turn.request.instructions, /untrusted data/);
  assert.equal(Object.isFrozen(turn.request.input[0]), true);
  assert.equal(Object.isFrozen(turn.request.tools[0].parameters.properties), true);
  assert.equal(Object.isFrozen(turn.reservation), true);
  input.toolNames.push("create_expense_claim"); input.model.id = "switched"; input.history[0].text = "changed";
  assert.equal(turn.request.model, model.id); assert.doesNotMatch(JSON.stringify(turn.request), /switched|changed/);
  invalid(turn.decode(JSON.stringify(response([call("create_expense_claim")]))), "INVALID_CALL");
  for (const option of ["instructions", "previous_response_id", "conversation", "credential", "identity", "organizationId", "store", "stream", "tools", "background", "provider"]) badRequest({ ...request(), [option]: "SECRET_PRIVATE" });
  badRequest({ ...request(), model: { ...model, endpoint: "https://private.invalid" } });
  for (const capability of ["functionCalls", "strictSchemas", "usage"]) badRequest({ ...request(), model: { ...model, [capability]: false } });
  badRequest({ ...request(), toolNames: ["list_contacts", "list_contacts"] });
  badRequest({ ...request(), toolNames: ["post_entry"] });
  badRequest({ ...request(), maxOutputTokens: 4097 }); badRequest({ ...request(), maxOutputTokens: 15 });
  badRequest({ ...request(), model: { ...model, outputTokens: 16 } });
  badRequest({ ...request(), model: { ...model, contextTokens: 4096 } });
  assert.equal(createResponsesTurn(request([])).request.tool_choice, "none");
});

test("every actual reviewed catalog schema compiles recursively strict, with descriptions and defaults intact", () => {
  const turn = createResponsesTurn(request(AI_TOOL_NAMES));
  assert.equal(turn.request.tools.length, 7);
  const inspect = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const schema = node as Record<string, unknown>;
    assert.equal("default" in schema, false); assert.equal("$schema" in schema, false);
    if (schema.properties) {
      const properties = schema.properties as Record<string, unknown>;
      assert.deepEqual(schema.required, Object.keys(properties)); assert.equal(schema.additionalProperties, false);
      for (const child of Object.values(properties)) { assert.ok((child as Record<string, unknown>).description); inspect(child); }
    }
    if (Array.isArray(schema.anyOf)) schema.anyOf.forEach(inspect);
    if (schema.items) inspect(schema.items);
  };
  turn.request.tools.forEach(tool => inspect(tool.parameters));
  const samples: Record<AiToolName, unknown> = {
    list_contacts: { page: null, limit: null, search: null, type: null }, get_contact: { contactId: id },
    list_entries: { page: null, limit: null, status: null, startDate: null, endDate: null }, get_entry: { entryId: id },
    list_expense_claims: { page: null, limit: null, status: null }, get_expense_claim: { expenseClaimId: id },
    create_expense_claim: { title: "قطعه Supplier", description: null, currencyCode: "IRR", items: [{ date: "2026-10-28", description: "دستمزد", amountMinor: "9007199254740991", accountId: null, taxRateId: null, costCenterId: null }] },
  };
  for (const name of AI_TOOL_NAMES) {
    const receipt = validCall(turn.decode(JSON.stringify(response([call(name, JSON.stringify(samples[name]))]))));
    assert.equal(receipt.name, name); assert.equal(receipt.catalogVersion, AI_TOOL_CATALOG[name].version);
    assert.deepEqual(AI_TOOL_CATALOG[name].schema.parse(receipt.arguments), receipt.arguments);
    if ("page" in receipt.arguments) { assert.equal(receipt.arguments.page, 1); assert.equal(receipt.arguments.limit, 25); }
    if (name === "create_expense_claim") {
      assert.equal((receipt.arguments.items as { amountMinor: string }[])[0].amountMinor, "9007199254740991");
      assert.equal(receipt.arguments.description, null);
    }
  }
  // Compilation cannot mutate the application schemas or change normal defaults.
  assert.deepEqual(AI_TOOL_CATALOG.list_contacts.schema.parse({}), { page: 1, limit: 25 });
  assert.ok(JSON.stringify(z.toJSONSchema(AI_TOOL_CATALOG.list_contacts.schema, { io: "input" })).includes('"default":1'));
});

test("dependent fixture turns preserve complete call/result correlation and canonical draft money", () => {
  const first = createResponsesTurn(request(["list_contacts", "get_contact", "create_expense_claim"]));
  const found = validCall(first.decode(JSON.stringify(response())));
  assert.deepEqual(found.arguments, { page: 1, limit: 25, search: "Supplier" });
  const history: ProviderTurnInput["history"] = [...request().history,
    { kind: "call", callId: found.callId, name: found.name, arguments: found.arguments },
    { kind: "result", callId: found.callId, output: JSON.stringify({ contacts: [{ id, name: "Supplier" }], untrusted: true }) },
  ];
  const second = createResponsesTurn({ ...request(["list_contacts", "get_contact", "create_expense_claim"]), history });
  const detail = validCall(second.decode(JSON.stringify(response([call("get_contact", JSON.stringify({ contactId: id }), "call_2")]))));
  assert.equal(detail.arguments.contactId, id);
  assert.equal(validCall(second.decode(JSON.stringify(response([call("get_contact", JSON.stringify({ contactId: id }), "call_2")])), [found.callId])).callId, "call_2");
  invalid(second.decode(JSON.stringify(response())), "INVALID_CALL");
  const draft = { title: "Supplier expense", description: null, currencyCode: "IRR", items: [{ date: "2026-10-28", description: "Work", amountMinor: "1250", accountId: null, taxRateId: null, costCenterId: null }] };
  const third = createResponsesTurn({ ...request(["list_contacts", "get_contact", "create_expense_claim"]), history: [...history,
    { kind: "call", callId: detail.callId, name: detail.name, arguments: detail.arguments }, { kind: "result", callId: detail.callId, output: '{"id":"' + id + '","untrusted":true}' },
  ] });
  const prepared = validCall(third.decode(JSON.stringify(response([call("create_expense_claim", JSON.stringify(draft), "call_3")]))));
  assert.deepEqual(prepared.arguments, draft);
  const last = createResponsesTurn({ ...request(["list_contacts", "get_contact", "create_expense_claim"]), history: [...history,
    { kind: "call", callId: prepared.callId, name: prepared.name, arguments: prepared.arguments }, { kind: "result", callId: prepared.callId, output: '{"status":"draft","untrusted":true}' },
  ] });
  const final = last.decode(JSON.stringify(response([message("Created https://evil.invalid/posted ; SECRET_PRIVATE is model text.")])));
  assert.equal(final.status, "valid");
  if (final.status !== "valid") assert.fail();
  assert.equal(final.finish, "completed"); assert.deepEqual(final.calls, []);
  assert.match(final.untrustedText, /evil.invalid/);
  assert.equal("records" in final, false); assert.equal("links" in final, false); assert.equal("succeeded" in final, false);
  // Pure protocol text remains explicitly untrusted. Only the later worker's
  // permission-checked receipts can publish a final business result.
});

test("history refuses forged roles, orphan/duplicate calls, revoked tools and incomplete argument bodies", () => {
  const input = request(["list_contacts", "get_contact"]), history = input.history;
  for (const role of ["system", "developer", "tool", "reasoning"]) badRequest({ ...input, history: [{ kind: role, text: "SECRET_PRIVATE" }] });
  badRequest({ ...input, history: [{ kind: "assistant", text: "SECRET_PRIVATE" }, ...history] });
  badRequest({ ...input, history: [...history, { kind: "assistant", text: "done" }] });
  const past = { kind: "call", callId: "past_1", name: "get_contact", arguments: { contactId: id } };
  const result = { kind: "result", callId: "past_1", output: "{}" };
  for (const extra of [[result], [past], [past, { ...result, callId: "wrong" }], [past, ...history, result], [past, result, past, result], [past, result, result]]) badRequest({ ...input, history: [...history, ...extra] });
  badRequest({ ...request(), history: [...history, past, result] });
  badRequest({ ...input, history: [...history, { ...past, arguments: { contactId: id, organizationId: id } }, result] });
  badRequest({ ...input, history: Array.from({ length: 65 }, () => history[0]) });
  const complete = createResponsesTurn({ ...input, history: [...history, { ...past, kind: "call" }, { ...result, kind: "result" }] as ProviderTurnInput["history"] });
  const wire = complete.request.input[1];
  assert.equal("type" in wire && wire.type, "function_call");
});

test("request objects and serialized requests have byte/depth/data limits without invoking getters", () => {
  badRequest({ ...request(), history: [{ kind: "user", text: "ی".repeat(32768) }] });
  const input = request(), deep: Record<string, unknown> = {}; let tail = deep;
  for (let depth = 0; depth < 26; depth++) { tail.next = {}; tail = tail.next as Record<string, unknown>; }
  badRequest({ ...input, deep });
  const cycle: Record<string, unknown> = {}; cycle.self = cycle; badRequest({ ...input, cycle });
  let invoked = false;
  badRequest(Object.defineProperty({ ...input }, "credential", { enumerable: true, get() { invoked = true; throw new Error("SECRET_PRIVATE"); } }));
  assert.equal(invoked, false);
  badRequest({ ...input, date: new Date() }); badRequest({ ...input, count: 1n }); badRequest({ ...input, number: Infinity });
  badRequest({ ...input, toJSON() { invoked = true; return {}; } }); assert.equal(invoked, false);
  let shared: unknown = "leaf";
  for (let depth = 0; depth < 20; depth++) shared = [shared, shared];
  badRequest({ ...input, shared }); // Stop shared-object expansion before serialization.
  badRequest({ ...input, sparse: new Array(1000000) });
  const names = AI_TOOL_NAMES;
  // Each member is small, but the full encoded request (schemas included) exceeds 64 KiB.
  badRequest({ ...request(names), history: [{ kind: "user", text: "x".repeat(62000) }] });
});

test("whole-response validation prevents dispatch of early valid calls followed by corrupt/hosted/private output", () => {
  const turn = createResponsesTurn(request());
  const cases: unknown[][] = [
    [call(), call("list_contacts", "{}", "call_2", "fc_2")],
    [call(), { ...call(), id: "fc_2" }], [call(), message(), { id: "opaque", type: "reasoning", status: "completed", content: "SECRET_PRIVATE" }],
    [call(), { id: "fc_2", type: "web_search_call", status: "completed" }],
    [call(), { ...message(), role: "system" }], [call(), { ...message(), id: "fc_1" }],
    [call(), { ...message(), content: [{ type: "output_text", text: "bad", annotations: [{ url: "https://evil.invalid" }] }] }],
    [call(), { ...message(), content: [{ type: "refusal", refusal: "SECRET_PRIVATE" }] }],
    [call(), { ...message(), content: [{ type: "output_text", text: "bad", annotations: [], logprobs: ["SECRET_PRIVATE"] }] }],
    [call(), { ...message(), private_reasoning: "SECRET_PRIVATE" }],
  ];
  for (const items of cases) {
    const receipt = invalid(turn.decode(JSON.stringify(response(items))));
    assert.equal(receipt.usage.inputTokens, "100"); assert.doesNotMatch(JSON.stringify(receipt), /SECRET_PRIVATE|evil/);
  }
  assert.equal(validCall(turn.decode(JSON.stringify(response([message("Working"), call()])))).name, "list_contacts");
});

test("response validates exact model/status/items and refuses partial or unknown finishes without losing metering", () => {
  const turn = createResponsesTurn(request());
  for (const status of ["in_progress", "incomplete", "failed", "cancelled", "tool_calls", "length", "future"]) {
    invalid(turn.decode(JSON.stringify({ ...response(), status })), "OUTPUT_INCOMPLETE");
  }
  invalid(turn.decode(JSON.stringify({ ...response(), model: "fallback-model" })), "MODEL_CHANGED");
  for (const extra of [{ error: { message: "SECRET_PRIVATE" } }, { incomplete_details: { reason: "max_output_tokens" } }]) invalid(turn.decode(JSON.stringify({ ...response(), ...extra })), "OUTPUT_INCOMPLETE");
  for (const output of [[], null, [call(), message(), message(), message(), message()], [{ ...call(), status: "in_progress" }], [{ ...call(), id: "bad id" }], [null], [message(" \n ")]]) invalid(turn.decode(JSON.stringify({ ...response(), output })));
  invalid(turn.decode(JSON.stringify({ ...response(), output: [call("post_entry")] })), "INVALID_CALL");
  invalid(turn.decode(JSON.stringify(response()), ["call_1"]), "INVALID_CALL");
  invalid(turn.decode(JSON.stringify(response()), Array.from({ length: 21 }, (_, i) => `seen_${i}`)), "INVALID_CALL");
  const twentySeen = Array.from({ length: 20 }, (_, i) => `seen_${i}`);
  invalid(turn.decode(JSON.stringify(response()), twentySeen), "INVALID_CALL");
  assert.equal(turn.decode(JSON.stringify(response([message()])), twentySeen).status, "valid");
  invalid(turn.decode(JSON.stringify(response()), ["../unsafe"]), "INVALID_CALL");
});

test("strict arguments reject omitted wire fields, duplicate escaped keys, forged scope, bad dates and numeric money", () => {
  const turn = createResponsesTurn(request(AI_TOOL_NAMES));
  const badArguments = ["{}", '{"page":1,"limit":25,"search":null}', '{"page":1,"limit":25,"search":null,"type":null,"organizationId":"' + id + '"}',
    '{"page":1,"page":2,"limit":25,"search":null,"type":null}', '{"page":1,"p\\u0061ge":2,"limit":25,"search":null,"type":null}',
    '{"page":1,"limit":25,"search":null,"type":null,}', '[1,2]', '"SECRET_PRIVATE"', '{"page":',
    '{"page":1,"limit":25,"search":null,"type":null,"__proto__":{}}',
  ];
  for (const args of badArguments) invalid(turn.decode(JSON.stringify(response([call("list_contacts", args)]))), "INVALID_CALL");
  invalid(turn.decode(JSON.stringify(response([call("get_contact", '{"contactId":null}')]))), "INVALID_CALL");
  const draft = { title: "Expense", description: null, currencyCode: "IRR", items: [{ date: "2026-10-28", description: "work", amountMinor: "1250", accountId: null, taxRateId: null, costCenterId: null }] };
  for (const overrides of [{ amountMinor: 1250 }, { amountMinor: "01250" }, { amountMinor: "1e3" }, { amountMinor: "9007199254740992" }, { date: "1405/08/06" }, { date: "2026-02-30" }, { approval: true }, { amount: 12.5 }]) {
    invalid(turn.decode(JSON.stringify(response([call("create_expense_claim", JSON.stringify({ ...draft, items: [{ ...draft.items[0], ...overrides }] }))]))), "INVALID_CALL");
  }
});

test("raw envelope JSON refuses duplicate/deep/oversized/nonfinite/trailing input with unknown reservation retained", () => {
  const turn = createResponsesTurn(request());
  const raw = JSON.stringify(response());
  const duplicates = raw.replace('"status":"completed"', '"status":"failed","status":"completed"');
  for (const input of [duplicates, raw + " true", raw.slice(0, -1), raw.replace('"input_tokens":100', '"input_tokens":1e999'),
    '{"model":"x","m\\u006fdel":"x"}', '{"__proto__":{}}', '{"a":01}', '{"a":undefined}',
    "[".repeat(26) + "0" + "]".repeat(26), JSON.stringify({ ...response(), diagnostics: "ی".repeat(32768) }),
  ]) {
    assert.deepEqual(invalid(turn.decode(input), "INVALID_JSON").usage, { inputTokens: null, outputTokens: null, cachedTokens: null, reasoningTokens: null });
  }
  invalid(turn.decode("null"), "INVALID_RESPONSE"); invalid(turn.decode("[]"), "INVALID_RESPONSE");
});

test("independent usage keeps known totals on invalid output, partial data, ceiling overrun and inconsistent subsets", () => {
  const turn = createResponsesTurn(request());
  const read = (value: unknown) => turn.decode(JSON.stringify({ ...response(), usage: value }));
  for (const value of [null, {}, { input_tokens: "100", output_tokens: 20, total_tokens: 120 }, { input_tokens: 100, output_tokens: -1, total_tokens: 99 }, { input_tokens: Number.MAX_SAFE_INTEGER + 1, output_tokens: 20 }]) invalid(read(value), "INVALID_USAGE");
  assert.equal(invalid(read({ input_tokens: 100, output_tokens: null }), "INVALID_USAGE").usage.inputTokens, "100");
  assert.equal(invalid(read({ input_tokens: 100, output_tokens: 20, total_tokens: 999 }), "INVALID_USAGE").usage.outputTokens, "20");
  const over = invalid(read({ ...usage, input_tokens: 12000, total_tokens: 12020 }), "USAGE_CEILING_EXCEEDED");
  assert.equal(over.usage.inputTokens, "12000");
  assert.equal(invalid(read({ ...usage, output_tokens: 4097, total_tokens: 4197 }), "USAGE_CEILING_EXCEEDED").usage.outputTokens, "4097");
  const subsets = invalid(read({ ...usage, input_tokens_details: { cached_tokens: 101 } }), "INVALID_USAGE");
  assert.equal(subsets.usage.inputTokens, "100"); assert.equal(subsets.usage.cachedTokens, null);
  for (const details of ["not-an-object", { cached_tokens: -1 }, { cached_tokens: "10" }]) {
    assert.equal(invalid(read({ ...usage, input_tokens_details: details }), "INVALID_USAGE").usage.inputTokens, "100");
  }
  const noDetails = read({ input_tokens: 100, output_tokens: 20, total_tokens: 120 });
  assert.equal(noDetails.status, "valid"); assert.deepEqual(noDetails.usage, { inputTokens: "100", outputTokens: "20", cachedTokens: null, reasoningTokens: null });
  const invalidOutput = invalid(turn.decode(JSON.stringify({ ...response(), output: [{ type: "reasoning", id: "r_1", status: "completed", summary: ["SECRET_PRIVATE"] }] })), "UNSUPPORTED_OUTPUT");
  assert.deepEqual(invalidOutput.usage, { inputTokens: "100", outputTokens: "20", cachedTokens: "10", reasoningTokens: "0" });
});
