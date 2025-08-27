export type FilterExpressionFunctions = "contains";

export type Filters<T> = {
  [K in keyof T]: Partial<FilterExpression<T[K]>>;
};

export type FilterExpression<T> = {
  [K in FilterExpressionFunctions]?: T;
};
