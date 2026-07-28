export function approx(a: number, b: number, tol = 3): boolean {
	return Math.abs(a - b) <= tol;
}
