import { describe, expect, it } from 'vitest';
import type { INodeProperties } from 'n8n-workflow';

import { handlers } from '../nodes/Linkwarden/actions';
import { Linkwarden } from '../nodes/Linkwarden/Linkwarden.node';

const properties = new Linkwarden().description.properties;

/** Top-level properties shown for a resource/operation (ignoring show conditions on other fields). */
function visible(resource: string, operation: string): INodeProperties[] {
	return properties.filter((p) => {
		const show = p.displayOptions?.show;
		if (!show) return true;
		if (show.resource && !show.resource.includes(resource)) return false;
		if (show.operation && !show.operation.includes(operation)) return false;
		return true;
	});
}

const operationsOf = (resource: string) => {
	const prop = properties.find(
		(p) => p.name === 'operation' && p.displayOptions?.show?.resource?.includes(resource),
	);
	return (prop?.options ?? []).map((o) => (o as { value: string }).value);
};

describe('node description', () => {
	it('lists every resource and operation that has a handler, and vice versa', () => {
		for (const [resource, ops] of Object.entries(handlers)) {
			expect(operationsOf(resource).sort(), resource).toEqual(Object.keys(ops).sort());
		}
	});

	it('shows every parameter a handler reads directly', () => {
		const missing: string[] = [];
		for (const [resource, ops] of Object.entries(handlers)) {
			for (const [operation, handler] of Object.entries(ops)) {
				const source = handler.toString();
				const names = [
					...source.matchAll(/getNodeParameter\(\s*["'](\w+)["']/g),
					...source.matchAll(/getLocator\(\s*\w+,\s*["'](\w+)["']/g),
				].map((m) => m[1]);
				const shown = new Set(visible(resource, operation).map((p) => p.name));
				for (const name of names) {
					if (!shown.has(name)) missing.push(`${resource}.${operation}: ${name}`);
				}
			}
		}
		expect(missing).toEqual([]);
	});
});
