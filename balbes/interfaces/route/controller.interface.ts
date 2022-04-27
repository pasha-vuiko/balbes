export type RouteController<T = any> = (args: RouteControllerParams) => Promise<T>;

export interface RouteControllerParams {
	params: Record<string, string>,
	query: Record<string, string>,
	headers: Record<string, string | string[] | undefined>,
	extraContext: Map<string, any>
	body?: any
}
