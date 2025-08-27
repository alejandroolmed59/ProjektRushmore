import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { FilterExpressionFunctions, Filters } from "../types";

export enum EXPRESSION_JOIN {
  COMA = ", ",
  AND = " AND ",
  OR = " OR ",
}

/**
 * Generates a expression in the form of `#key=:value` using the required keys from a partial interface
 *
 * @example
 * ```ts
 * interface UserDefinedRule {
 *   household_id: principal;
 *   rule_id: principal;
 *   content: string;
 *   name: string;
 *   enabled: boolean;
 * }
 * const data: Partial<UserDefinedRule> = { household_id: '1', rule_id: '2'};
 * const result = ExpressionMaker<UserDefinedRule>(data, EXPRESSION_JOIN.COMA);
 * ```
 * or
 * @example
 * ```
 * const result = ExpressionMaker<UserDefinedRule>(data, EXPRESSION_JOIN.COMA, ["rule_id","household_id"]);
 * ```
 * @param data Generic type inferred using T, to generate the `#key=:value` pairs from
 *
 * Example:
 * ```ts
 * const data: Partial<UserDefinedRule> = { household_id: '1', rule_id: '2', name:'3', enabled:true};
 * ```
 * @param join Separator character to use as expression join enum `, `  | `AND`  | `OR`
 * @param [excludedProperties] (Optional) array of property names we don't want to be included in the returned string
 * @returns string with all `#key=:value` pairs
 *
 * If `excludedProperties` is provided and contains `household_id` and `rule_id`, returned string will be `SET #name: ':name', #enabled: ':enabled'`
 * @example EXPRESSION_JOIN.COMA ==> '#household_id' = ':household_id', '#rule_id' = ':rule_id'
 * @example EXPRESSION_JOIN.AND ==> '#household_id' = ':household_id' AND '#rule_id' = ':rule_id'
 */
export const ExpressionMaker = <T>(
  data: Partial<T>,
  join: EXPRESSION_JOIN,
  excludedProperties?: string[],
): string => {
  return Object.keys(data)
    .map((p) => (excludedProperties?.includes(p) ? undefined : `#${p} = :${p}`))
    .filter((p) => p != undefined)
    .join(join.toString());
};

/**
 * DynamoDB has a set of reserved words that we need to bypass, this methods
 * allows us to define some alias around those reserved keywords by prefixing the
 * name of the attributes with a pound symbol.
 * see example bellow:
 *
 * Generates a SET expression from generic typed object: `SET #name: ':name', #enabled: ':enabled'`
 * ```ts
 * E.G
 * interface UserDefinedRule {
 *   household_id: principal;
 *   rule_id: principal;
 *   content: string;
 *   name: string;
 *   enabled: boolean;
 * }
 * const data: Partial<UserDefinedRule> = { household_id: '1', rule_id: '2', name:'3', enabled:true};
 * const result = UpdateExpressionMaker<UserDefinedRule>(data);
 * ```
 * or
 * ```
 * const result = UpdateExpressionMaker<UserDefinedRule>(data, ["rule_id","household_id"]);
 * ```
 *
 * @param data Generic type inferred using T, to generate the key/value pairs from.
 *
 * Example:
 * ```ts
 * const data: Partial<UserDefinedRule> = { household_id: '1', rule_id: '2', name:'3', enabled:true};
 * ```
 * @param [excludedProperties] (Optional) array of property names we don't want to be included in the returned string
 * @returns string - `SET #household_id = ':household_id', #rule_id: ':rule_id', #name: ':name', #enabled: ':enabled'`
 *
 * If `excludedProperties` is provided and contains `household_id` and `rule_id`, returned string will be `SET #name: ':name', #enabled: ':enabled'`
 */
export const UpdateExpressionMaker = <T>(
  data: Partial<T>,
  excludedProperties?: string[],
): string => {
  // UpdateExpression 'SET #column = :alias, #column2 = :alias2
  return `SET ${ExpressionMaker(data, EXPRESSION_JOIN.COMA, excludedProperties)}`;
};

/**
 * Converts an object into an :key=value record
 * @example
 * Record<string, any> result = { ':alias': value, ':name':'some name' },
 *
 * @param data Generic type inferred using T, to generate the key/value pairs from
 * @param [excludedProperties] (Optional) array of property names we don't want to be included in the returned record object
 * @returns object with alias to value equivalence
 * @example Record<string, any> result = { ':alias': value, ':name':'some name' },
 */
export const ExpressionAttributeValuesMaker = <T>(
  data: Partial<T>,
  excludedProperties?: string[],
) => {
  // ExpressionAttributeValues Record<string, any> = { ':alias': value },
  const obj: Record<string, unknown> = {};
  return Object.keys(data).reduce((acc, next) => {
    return excludedProperties?.includes(next)
      ? acc
      : Object.defineProperty(
          acc,
          `:${next}`,
          Object.getOwnPropertyDescriptor(data, next) as PropertyDescriptor,
        );
  }, obj);
};

/**
 *  Builds attribute name equivalence expression with '#' prefix. Helps when using reserved words as DB attribute names.
 * ```
 * E.G
 * Record<string, string> = { '#trigger': 'trigger' },
 * ```
 * @param data Generic type inferred using T, to generate the equivalence pairs from
 * @param [excludedProperties] (Optional) array of property names we don't want to be included in the returned record object
 * @returns
 */
export const ExpressionAttributeNamesMaker = <T>(
  data: Partial<T>,
  excludedProperties?: string[],
) => {
  // ExpressionAttributeValues Record<string, any> = { ':alias': value },
  const obj: Record<string, string> = {};
  return Object.keys(data).reduce((acc, next) => {
    return excludedProperties?.includes(next)
      ? acc
      : Object.defineProperty(acc, `#${next}`, {
          value: next,
          enumerable: true,
        } as PropertyDescriptor);
  }, obj);
};

/**
 * Destructures an Object into a Record<string, any> to be used as a matcher for table items
 * ```
 * E.G
 * const result = KeyAttributeMaker<Partial<UserDefinedRules>>({ rules_id: 'value'});
 * result = { 'rules_id': value}
 * ```
 * @param data Generic type inferred using T, to generate the key/value pairs from
 * @constructor
 */
export const KeyAttributeMaker = <T>(data: Partial<T>) => {
  const obj: Record<string, unknown> = {};
  return Object.keys(data).reduce((acc, next) => {
    return Object.defineProperty(
      acc,
      next,
      Object.getOwnPropertyDescriptor(data, next) as PropertyDescriptor,
    );
  }, obj);
};

/**
 * Split object properties in 'keys' group for key attrs and 'attributes' group for non-key attrs
 * @param data  Generic type inferred using T, to generate the key/value pairs from
 * @param keyAttrNames Names of key attributes to do split
 * @returns `{ keys: {...}, attributes: {...} }`
 */
export const SplitKeyAttributeValues = <T>(data?: Partial<T>, keyAttrNames?: string[]) => {
  const obj = { keys: {}, attributes: {} };
  return (
    data &&
    Object.keys(data).reduce((acc, next) => {
      if (keyAttrNames?.includes(next)) {
        Object.defineProperty(
          acc.keys,
          next,
          Object.getOwnPropertyDescriptor(data, next) as PropertyDescriptor,
        );
      } else {
        Object.defineProperty(
          acc.attributes,
          next,
          Object.getOwnPropertyDescriptor(data, next) as PropertyDescriptor,
        );
      }
      return acc;
    }, obj)
  );
};

/**
 * Builds the contains filter expression
 * @param objectKey Property name to apply contains expression
 * @param idx Optional index value to make each expression evaluation unique
 * @returns `"contains(propertyName, :contains${propertyNameKey}${idx})"`
 */
export const buildContainsFilterExpression = (objectKey: string, idx = 0): string => {
  return `contains(${objectKey}, :contains${objectKey}${idx})`;
};

/**
 * Joins filter expression values by function, wether the filter needs to be applied for single or multiple values
 * @param filters Generic type inferred using T, to generate the filter expressions from
 * @param join Separator character to use as expression join enum `, `  | `AND`  | `OR`
 * @returns `"contains(propertyName, :contains${propertyNameKey}${idx}) AND contains(propertyName, :contains${propertyNameKey}${idx})"`
 */
export const FilterExpressionMaker = <T>(filters: Partial<Filters<T>>, join: EXPRESSION_JOIN) => {
  return Object.entries(filters)
    .map(([objectKey, filter]) => {
      return Object.entries(filter as object).map(([filterKey, values]) => {
        const filterExpressionFunction = filterKey as FilterExpressionFunctions;
        const isArray = Array.isArray(values);

        if (filterExpressionFunction === "contains") {
          return isArray
            ? values.map((_, idx) => buildContainsFilterExpression(objectKey, idx)).join(join)
            : buildContainsFilterExpression(objectKey);
        } else return "";
      });
    })
    .flat()
    .join(join);
};

/**
 * Converts a Filters object into an :key=value record
 *
 * @param filters Generic type inferred using T, to generate the key/value pairs from
 * @returns object with alias to value equivalence
 * @example Record<string, any> result = { ':alias': value, ':name':'some name' },
 */
export const FilterExpressionAttributeValuesMaker = <T>(filters?: Partial<Filters<T>>) => {
  return filters
    ? Object.entries(filters)
        .map(([objectKey, filter]) => {
          return Object.entries(filter as object).map(([filterKey, values]) => {
            const isArray = Array.isArray(values);
            const filterValues: Record<string, unknown> = {};
            return isArray
              ? values
                  .map((value, idx) => ({
                    [`:${filterKey}${objectKey}${idx}`]: value,
                  }))
                  .reduce((acc, next) => ({ ...acc, ...next }), {})
              : Object.defineProperty(
                  filterValues,
                  `:${filterKey}${objectKey}0`,
                  Object.getOwnPropertyDescriptor(filter, filterKey) as PropertyDescriptor,
                );
          });
        })
        .flat()
        .reduce((acc, next) => ({ ...acc, ...next }), {})
    : {};
};

/**
 * Converts a Partial<T> object into a DynamoDB AttributeValue record
 *
 * @param data Generic type inferred using T, to generate the AttributeValue pairs from
 * @returns Record<string, AttributeValue> with DynamoDB formatted values
 * @example
 * Input: {
 *   id: "123",
 *   count: 5,
 *   isActive: true,
 *   tags: ["tag1", "tag2"],
 *   metadata: { created: "2024-01-01" }
 * }
 * Output: {
 *   id: { S: "123" },
 *   count: { N: "5" },
 *   isActive: { BOOL: true },
 *   tags: { L: [{ S: "tag1" }, { S: "tag2" }] },
 *   metadata: { M: { created: { S: "2024-01-01" } } }
 * }
 */
export const DynamoDBJSONConverter = <T>(data: Partial<T>): Record<string, AttributeValue> => {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      if (typeof value === "string") {
        acc[key] = { S: value };
      } else if (typeof value === "number") {
        acc[key] = { N: value.toString() };
      } else if (typeof value === "boolean") {
        acc[key] = { BOOL: value };
      } else if (Array.isArray(value)) {
        acc[key] = {
          L: value.map((item) => {
            if (typeof item === "string") return { S: item };
            if (typeof item === "number") return { N: item.toString() };
            if (typeof item === "boolean") return { BOOL: item };
            if (typeof item === "object" && item !== null) {
              return { M: DynamoDBJSONConverter(item) };
            }
            return { NULL: true };
          }),
        };
      } else if (typeof value === "object" && value !== null) {
        acc[key] = { M: DynamoDBJSONConverter(value) };
      }
    }
    return acc;
  }, {} as Record<string, AttributeValue>);
};
