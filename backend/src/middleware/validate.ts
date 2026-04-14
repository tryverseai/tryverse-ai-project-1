import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export function handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const arr = errors.array();
    const first = arr[0];
    const summary =
      first && typeof first === 'object' && first !== null && 'msg' in first
        ? String((first as { msg: string }).msg)
        : 'Validation failed';
    res.status(400).json({
      error: summary,
      // 'path' is the validated field name in express-validator v6+; 'type' is a
    // classifier string (e.g. "field") — not the field name.
    details: arr.map((e) => ({ field: 'path' in e ? (e as { path: string }).path : e.type, message: e.msg })),
    });
    return;
  }
  next();
}
