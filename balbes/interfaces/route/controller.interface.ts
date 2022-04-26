export type RouteController = <T>(args: RouteControllerParams) => Promise<T>;

export interface RouteControllerParams {
	params: Record<string, string>,
	query: Record<string, string>,
	headers: Record<string, string>,
	extraContext: Record<string, any>
	body?: any
}
