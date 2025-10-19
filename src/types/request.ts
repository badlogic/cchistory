/**
 * Type definitions for Claude API request/response pairs
 */

export interface CacheControl {
	type: string;
}

export interface InputSchema {
	type?: string;
	properties?: Record<string, unknown>;
	required?: string[];
	[key: string]: unknown;
}

export interface Tool {
	name: string;
	description: string;
	input_schema: InputSchema;
}

export interface MessageContent {
	type: string;
	text?: string;
	cache_control?: CacheControl;
}

export interface Message {
	role: string;
	content: string | MessageContent[];
}

export interface SystemBlock {
	type: string;
	text: string;
	cache_control?: CacheControl;
}

export interface RequestBody {
	model: string;
	messages: Message[];
	temperature?: number;
	system?: SystemBlock[];
	tools?: Tool[];
}

export interface Request {
	timestamp: number;
	method: string;
	url: string;
	headers: Record<string, string>;
	body: RequestBody;
}

export interface RequestResponsePair {
	request: Request;
	response: Record<string, unknown>;
}
