import { z } from "zod";
import "../modules/hospital/routes";
import { hospitalOperations } from "../modules/hospital/common";
import { SYSTEM_ROLES, permissionsForRoles } from "../config/permissions";

export function inputSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodEffects) return inputSchema(schema.innerType());
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) return inputSchema(schema.unwrap());
  if (schema instanceof z.ZodDefault) return { ...inputSchema(schema.removeDefault()), default: schema._def.defaultValue() };
  if (schema instanceof z.ZodObject) {
    const entries = Object.entries(schema.shape) as Array<[string, z.ZodTypeAny]>;
    return { type: "object", additionalProperties: false, properties: Object.fromEntries(entries.map(([key, value]) => [key, inputSchema(value)])), required: entries.filter(([, value]) => !value.isOptional()).map(([key]) => key) };
  }
  if (schema instanceof z.ZodArray) return { type: "array", items: inputSchema(schema.element), ...(schema._def.minLength ? { minItems: schema._def.minLength.value } : {}), ...(schema._def.maxLength ? { maxItems: schema._def.maxLength.value } : {}) };
  if (schema instanceof z.ZodEnum) return { type: "string", enum: schema.options };
  if (schema instanceof z.ZodUnion) return { oneOf: schema.options.map(inputSchema) };
  if (schema instanceof z.ZodBoolean) return { type: "boolean" };
  if (schema instanceof z.ZodNumber) return { type: schema.isInt ? "integer" : "number", ...(schema.minValue !== null ? { minimum: schema.minValue } : {}), ...(schema.maxValue !== null ? { maximum: schema.maxValue } : {}) };
  if (schema instanceof z.ZodString) return { type: "string", ...(schema.isUUID ? { format: "uuid" } : schema.isDatetime ? { format: "date-time" } : schema.isEmail ? { format: "email" } : {}), ...(schema.minLength !== null ? { minLength: schema.minLength } : {}), ...(schema.maxLength !== null ? { maxLength: schema.maxLength } : {}) };
  return {};
}

export function hospitalPaths() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const operation of hospitalOperations) {
    const schema = inputSchema(operation.schema);
    const properties = schema.properties as Record<string, unknown> | undefined;
    const required = schema.required as string[] | undefined;
    const pathParams = [...operation.path.matchAll(/\{(\w+)\}/g)].map(match => ({ in: "path", name: match[1], required: true, schema: { type: "string", format: "uuid" } }));
    paths[operation.path] ??= {};
    paths[operation.path]![operation.method] = {
      tags: ["Hospital"], summary: `${operation.method.toUpperCase()} ${operation.path}`, security: [{ bearerAuth: [] }],
      "x-required-permissions": [operation.permission], "x-required-roles": SYSTEM_ROLES.filter(role => permissionsForRoles([role]).includes(operation.permission)),
      parameters: [...pathParams, ...(operation.method === "get" ? Object.entries(properties ?? {}).map(([name, property]) => ({ in: "query", name, required: required?.includes(name) ?? false, schema: property })) : [])],
      ...(operation.method === "get" ? {} : { requestBody: { required: true, content: { "application/json": { schema } } } }),
      responses: { "200": { description: "Success; response envelope is { data }" }, "201": { description: "Created or idempotent replay; response envelope is { data }" }, "400": { description: "Invalid input" }, "401": { description: "Authentication required" }, "403": { description: "Permission denied" }, "404": { description: "Resource outside scope or missing" }, "409": { description: "Invalid transition, balance, capacity or duplicate-request conflict" } },
    };
  }
  return paths;
}
