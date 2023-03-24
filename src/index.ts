// (C) Sergey Rassokhin, 2020

// ----------------------------------------
// Public helpers
// ----------------------------------------

/**
 * Cross-multiplies multiple `Iterable's` of the same type T into `Stream<T[]>`. Can accept any number of args.
 * This function can be used as a shortcut - `from(someIterable)` instead of `new Stream<>(someIterable)`.
 *
 * Example of usage:
 * ```
 * const result = from([1, 3], [2, 4])
 *   .toArray();
 * expect(result).toStrictEqual([[1, 3], [1, 4], [2, 3], [2, 4]]);
 * ```
 * @param first
 * @param second
 * @param rest
 */
export function from<T>(first: Iterable<T>, second: Iterable<T>, ...rest: Iterable<T>[]): Stream<T[]> {
  const iterables = [first, second, ...rest];
  const iterators: Iterator<T>[] = [first[Symbol.iterator]()];
  const values: T[] = [];
  const generator = function* () {
    while (true) {
      const next = last(iterators)!.next(); // [unsafe] iterators always non-empty here
      if (next.done) {
        iterators.pop();
        if (isEmpty(iterators)) {
          break;
        }
        values.pop();
      } else {
        values.push(next.value);
        if (values.length === iterables.length) {
          yield [...values];
          values.pop();
        } else {
          iterators.push(iterables[iterators.length][Symbol.iterator]());
        }
      }
    }
  };
  return new Stream<T[]>(generator);
}

/**
 * Creates a `Stream<number>` with all numbers from the range.
 * Example of usage:
 * ```
 * const result = range(0, 10)
 *   .toArray();
 *
 * expect(result).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
 * ```
 * @param from start of range (inclusive)
 * @param to end of range (inclusive)
 */
export function range(from: number, to: number): Stream<number> {
  const generator = function* () {
    for (let i = from; i <= to; i++) {
      yield i;
    }
  };
  return new Stream(generator);
}

// ----------------------------------------
// Public types
// ----------------------------------------

export type ComparisonOp = "<" | ">" | "<=" | ">=" | "==" | "!=";

/**
 * Join type.
 */
export enum JoinType {
  /**
   * `[1,2] inner asc join [2,3] -> [{key: 2, left: 2, right: 2}]`
   */
  INNER_ASC = 4,
  /**
   *  `[1,2] left asc join [2,3] -> [{key: 1, left: 2, right: null}, {key: 2, left: 2, right: 2}]`
   */
  LEFT_ASC = 5,
  /**
   * `[1,2] right asc join [2,3] -> [{key: 2, left: 2, right: 2}, {key: 3, left: null, right: 3}]`
   */
  RIGHT_ASC = 6,
  /**
   * `[1,2] full asc join [2,3] -> [{key: 1, left: 1, right: null}, {key: 2, left: 2, right: 2}, {key: 3, left: null,
   * right: 3}]`
   */
  FULL_ASC = 7,
  /**
   * `[2,1] inner desc join [3,2] -> [{key: 2, left: 2, right: 2}]`
   */
  INNER_DESC = 0,
  /**
   * `[2,1] left desc join [3,2] -> [{key: 2, left: 2, right: 2}, {key: 1, left: 2, right: null}]`
   */
  LEFT_DESC = 1,
  /**
   * `[2,1] right desc join [3,2] -> [{key: 3, left: 3, right: null}, {key: 2, left: 2, right: 2}]`
   */
  RIGHT_DESC = 2,
  /**
   * `[2,1] full desc join [3,2] -> [{key: 3, left: 3, right: null}, {key: 2, left: 2, right: 2}, {key: 1, left: 2,
   * right: null}]`
   */
  FULL_DESC = 3,
  /**
   *`[1,3,2] inner unsorted join [2,1,4] -> [{key: 1, left: 2, right: 1}, {key: 2, left: 2, right: 2}]`
   */
  INNER_UNSORTED = 8,
  /**
   *  `[1,3,2] left unsorted join [2,1,4] -> [{key: 1, left: 2, right: 1}, {key: 3, left: null, right: 3}, {key: 2,
   * left: 2, right: 2}]`
   */
  LEFT_UNSORTED = 9
}

/**
 * Field (property) of T.
 */
export type Field<T> = keyof T;

/**
 * Function T => R
 */
export type Fn<T = any, R = any> = (t: T) => R | null;

/**
 * Field name of type `T` or function that accepts `T` and returns `any`.
 */
export type FieldOrFn<T> = Field<T> | Fn<T>;

/**
 * Type of `T[K]`. For example, if `T = {name: string, age: number}` and `K = "age"` then `T[K] = number`.
 */
export type Val<T, K extends FieldOrFn<T>> =
    [FieldOrFn<T>] extends [K] ? T : // means K is not specified
        K extends Field<T> ?
            T[K] :
            K extends Fn<T, infer R> ?
                R :
                never;

export type JoinEntry<L, R, JoinTypeT extends JoinType> =
    {
      key: any,
      left: L | (JoinTypeT extends JoinType.RIGHT_DESC | JoinType.FULL_DESC | JoinType.RIGHT_ASC | JoinType.FULL_ASC
          ? null : never),
      right: R | (JoinTypeT extends JoinType.LEFT_DESC | JoinType.FULL_DESC | JoinType.LEFT_ASC | JoinType.FULL_ASC
          ? null : never)
    }

// ----------------------------------------
// Stream class implementation
// ----------------------------------------

/**
 * Stream class that wraps `Iterable<T>` and provides most of the common FP-style operations like map, filter,
 * flatMap etc. as well as SQL-style select, where, join etc. Stream does also implement `Iterable<T>` so it can
 * wrap other stream, and since most of the operations return `Stream<T>`, the calls can be easily chained with each
 * other, for example:
 * ```
 * const numbers: Array<number> = ...
 * const evenSquares = new Stream(numbers)
 *    .filter(v => v % 2 == 0)
 *    .map(v => v * v)
 *    .toArray();
 * ```
 * Types can be primitives (as in the example above) but can also be Objects, so SQL-like instructions can be used:
 * ```
 * const users: Array<{name: string, age: number, city: string}> = ...
 * const usersByCity = new Stream(users)
 *   .where("age", ">=", 25)
 *   .groupBy("city")
 *   .toArray();
 * ```
 */
export class Stream<T> implements Iterable<T> {
  // instance of Iterable which is a main source of data
  private readonly $internal: Iterable<T>;

  /**
   * Creates a new instance of Stream by wrapping existing `Iterable<T>` or just a function that returns
   * `Iterator<T>` (so generator function can be passed as well). For example:
   * ```
   * // from Iterable<T>
   * const fromIterable = new Stream([1,2,3,4]);
   *
   * // from () => Iterator<T>
   * function* generator() {
   *   yield 1;
   *   yield 2;
   *   yield 3;
   * }
   * const fromGenerator = new Stream(generator);
   * ```
   *
   * @param iterableOrIteratorFactory instance of `Iterable<T>` or () => `Iterator<T>`
   */
  constructor(iterableOrIteratorFactory: Iterable<T> | (() => Iterator<T>)) {
    if (iterableOrIteratorFactory instanceof Function) {
      this.$internal = {
        [Symbol.iterator]: iterableOrIteratorFactory
      }
    } else {
      this.$internal = iterableOrIteratorFactory;
    }
  }

  [Symbol.iterator](): Iterator<T> {
    return this.$internal[Symbol.iterator]();
  }

  private* $maploop<R>(fn: (t: T, prevT?: T, prevR?: R) => R | undefined) {
    let prevR = undefined;
    let prevT = undefined;
    for (let v of this.$internal) {
      const r = fn(v, prevT, prevR);
      prevR = r;
      prevT = v;
      if (r != undefined) {
        yield r;
      }
    }
  }

  // ----------------------------------------
  // Common functional programming operations
  // ----------------------------------------

  /**
   * Filters elements given a predicate function.
   * Example of usage:
   * ```
   * const evens = new Stream([1, 2, 3])
   *   .filter(i => i % 2 == 0)
   *   .toArray();
   * ```
   * @param predicate function that accepts element and return true or false
   */
  public filter(predicate: (t: T) => boolean): Stream<T> {
    return new Stream<T>(this.$maploop(t => predicate(t) ? t : undefined));
  }

  /**
   * Maps each element of a current stream with a mapper function and returns new Stream of newly created elements.
   * Example of usage:
   * ```
   * const squares = new Stream([1, 2, 3])
   *   .map(i => i * i)
   *   .toArray();
   *
   * expect(even).toStrictEqual([2]);
   * ```
   * @param mapFn function that accepts current element and returns a new one. The function can optionally accept prev
   * element (original and mapped one).
   */
  public map<R>(mapFn: (t: T, prevT?: T, prevR?: R) => R): Stream<R> {
    return new Stream<R>(this.$maploop(mapFn));
  }

  /**
   * Flattens elements of this `Stream<Iterable<T>>` into `Stream<T>`.
   * Example of usage:
   * ```
   * const flattened = new Stream([[1,3], [2,4]])
   *    .flat()
   *    .toArray();
   *
   * expect(result).toStrictEqual([1, 3, 2, 4]);
   * ```
   */
  public flat(this: Stream<Iterable<any>>): Stream<T extends Iterable<infer E> ? E : never> {
    const _this = this;
    const generator = function* () {
      for (let outer of _this.$internal) {
        for (let inner of outer) {
          yield inner;
        }
      }
    };
    return new Stream(generator);
  }

  /**
   * First maps elements of `Stream<T>` to `Stream<Iterable<R>>` and then flattens into `Stream<R>`. For example:
   * ```
   * const flattened = new Stream([{numbers: [1, 3]}, {numbers: [2, 4]}])
   *   .flatMap("numbers")
   *   .toArray();
   * // "numbers" - name of a field that contains Iterable
   *
   * expect(result).toStrictEqual([1, 3, 2, 4]);
   * ```
   * @param field field extractor see `FieldOrFn<T>`
   */
  public flatMap<K extends FieldOrFn<T>>(field: K): Stream<Val<T, K> extends Iterable<infer E> ? E : never> {
    const keyFn = createKeyFn<T, K>(field) as (t: T) => Iterable<any>; // [unsafe] we check this in function result
    return this.map(keyFn).flat();
  }

  // SQL-like operations

  /**
   * Mimics SQL SELECT operator, by restricting set of fields that need be returned. Accepts list of field names, and
   * returns objects with only those fields, for example:
   * ```
   * const selectedAB = new Stream([{a: 1, b: "str", c: 3}]).select("a", "b");
   * const selectedA = new Stream([{a: 1, b: "str", c: 3}]).select("a");
   *
   * expect(selectedAB).toStrictEqual([{a: 1, b: "str"}]);
   * expect(selectedA).toStrictEqual([1]);
   * ```
   * @param field1 field name
   * @param field2 field name (none or many)
   */
  public select<U1 extends Field<T>, U2 extends Field<T> = never>(field1: U1, ...field2: U2[]):
      Stream<[U2] extends [never] ? T[U1] : { [P in U1 | U2]: T[P] }> {
    if (isEmpty(field2)) {
      return this.map(t => t[field1]) as any; // [safe] this is T[U1], could be derived by compiler
    }
    return this.map((t: T) => {
      const fields = [field1, ...field2];
      const newObj = {} as any; // [unsafe] couldn't find a better way
      for (const field of fields) {
        newObj[field] = t[field];
      }
      return newObj as any; // [safe] this is { [P in U1 | U2]: T[P] }, could be derived by compiler
    });
  }

  /**
   * Mimics SQL WHERE clause, by including only the records that satisfy given parameters.
   * Example of usages:
   * ```
   * const objs = [{a: 1, b: "val a", c: 3}, {a: 2, b: "val b", c: 4}, {a: 3, b: "val c", c: 4}];
   * const result = new Stream(objs)
   *   .where("a", "<", 3)
   *   .where("b", "!=", "val a")
   *   .toArray();
   *
   * expect(result).toStrictEqual([{a: 2, b: "val b", c: 4}]);
   * ```
   * @param field field name, see `Field<T>`
   * @param compareOp comparison operation, see `ComparisonOp`
   * @param value value of type `T[Field]` to compare with
   */
  public where<K extends FieldOrFn<T>>(field: K, compareOp: ComparisonOp, value: Val<T, K>): Stream<T> {
    const keyFn = createKeyFn<T, K>(field);
    return new Stream<T>(this.$maploop(t => {
      const val = keyFn(t);
      switch (compareOp) {
        case "<":
          return val < value ? t : undefined;
        case "<=":
          return val <= value ? t : undefined;
        case ">":
          return val > value ? t : undefined;
        case ">=":
          return val >= value ? t : undefined;
        case "==":
          return val === value ? t : undefined;
        case "!=":
          return val != value ? t : undefined;
      }
      return undefined;
    }));
  }

  /**
   * Mimics SQL JOIN operator. Depending on type of join, for each element of source stream lookups a corresponding
   * element from joined stream, using join parameter that can either be a field, or a function.
   *
   * If using SORTED join type, it will ensure that keys from both set come in the specified order, otherwise will
   *
   * raise an exception. This is the most intended usage of this operation as it won't need to pre-fetch all elements
   * from second stream in memory. The output keys order is preserved, i.e. if join order is ascending, then join
   * entries will be emitted with the keys being in ascending order.
   *
   * If using UNSORTED join type, it will pre-fetch all elements from second stream into a hash map before any join
   * entries can be emitted.
   *
   * Keys are not required to be unique, for duplicate keys, join entries will be multiplied, like it happens in SQL:
   * ```
   * [1,2,2] left join [2,2,3] = [{1,null}, {2,2}, {2,2}, {2,2}, {2,2}]
   * ```
   * Example of usage:
   * ```
   * let collectionA = [{a: 1, b: "val 1",}, {a: 2, b: "val 2",}, {a: 3, b: "val 3",}];
   * let collectionB = [{a: 1, b: "val a",}, {a: 2, b: "val b",}];
   * const joined = new Stream(collectionA)
   *   .join(collectionB, {joinType: JoinType.INNER_ASC, commonKey: "a"})
   *   .toArray();
   *
   * expect(result).toStrictEqual([
   *   {key: 1, left: {a: 1, b: "val 1"}, right: {a: 1, b: "val a"}},
   *   {key: 2, left: {a: 2, b: "val 2"}, right: {a: 2, b: "val b"}}
   * ]);
   * ```
   *
   * Optional parameters:
   *  * `commonKey?` - common field that belongs to both streams elements, or a function that can extract key from *T
   * &#124; O*; if provided, next 2 will be ignored;
   *  * `leftKey?`  - field that belongs to current (left) stream elements, or a function that can extract key from
   * `T`. If not provided, then elements will be used as keys and are supposed to be primitive;
   *  * `rightKey?` - field that belongs to other (right) stream elements, or a function that can extract key from `O`.
   * If not provided, then elements will be used as keys and are supposed to be primitive;
   *  * `joinType?` - join mode, default value is `JoinType.INNER_ASC` (see `JoinType` or README for more details);
   *
   * @param other stream to join
   * @param params object with a structure like `{joinType?, commonKey?, leftKey?, rightKey?}`
   */
  public join<O,
      KC extends FieldOrFn<T | O>,
      KL extends FieldOrFn<T>,
      KR extends FieldOrFn<O>,
      JT extends JoinType = JoinType.INNER_DESC>
  (
      other: Iterable<O>,
      params:
          {
            joinType?: JT
            commonKey?: KC
            leftKey?: KL
            rightKey?: KR
          } = {}
  ): Stream<JoinEntry<T, O, JT>> {
    const _this = this;

    // key functions
    const leftKeyFn: Fn<T> =
        createKeyFn(params.commonKey ?
            params.commonKey as unknown as KL :   // [safe] KC always compatible with KL and KR
            params.leftKey);

    const rightKeyFn: Fn<O> =
        createKeyFn(params.commonKey ?
            params.commonKey as unknown as KR :   // [safe] KC always compatible with KL and KR
            params.rightKey);

    // default join parameters
    const joinType = params.joinType ? params.joinType : JoinType.INNER_DESC;
    const joinResultFn = createJoinEntryFn<T, O, JT, KL, KR>(joinType);
    const sortOrder =
        joinType in set(JoinType.INNER_DESC, JoinType.LEFT_DESC, JoinType.RIGHT_DESC, JoinType.FULL_DESC) ?
            SortOrder.DESC :
            joinType in set(JoinType.INNER_ASC, JoinType.LEFT_ASC, JoinType.RIGHT_ASC, JoinType.FULL_ASC) ?
                SortOrder.ASC : null;

    // if unsorted join, use hash map for lookup
    if (sortOrder === null) {
      if (!(other instanceof Array)) {
        throw new Error(`Other iterable must be an Array if UNSORTED join is selected`);
      }
      const otherLookupMap = groupBy(other, rightKeyFn);
      const generator = function* () {
        for (const left of _this.$internal) {
          const leftKey = leftKeyFn(left);
          const rightLookupResult: O[] | undefined = otherLookupMap.get(leftKey);
          if (rightLookupResult) {
            for (const right of rightLookupResult) {
              yield joinResultFn(left, right, leftKey);
            }
          } else {
            // no values
            if (joinType == JoinType.LEFT_UNSORTED) {
              yield joinResultFn(left, null, leftKey);
            }
          }
        }
      };
      return new Stream(generator);
    }

    // create other (right) stream iterator
    const rightIter: Iterator<O> = other[Symbol.iterator]();

    // temp vars to keep track of current and previous keys
    let leftKeyPrevious: undefined | Val<T, KC | KL> = undefined;
    let rightKeyPrevious: undefined | Val<O, KC | KR> = undefined;
    let rightElementsBuffer: O[] = [];
    let rightElement: IteratorResult<O> = rightIter.next();

    // main generator
    const generator = function* () {
      for (const left of _this.$internal) {
        const leftKey = leftKeyFn(left);
        if (leftKey === undefined) {
          if (joinType == JoinType.LEFT_DESC || joinType == JoinType.FULL_DESC) {
            yield  joinResultFn(left, null, null);
          }
          continue;
        }
        if (leftKeyPrevious != leftKey) {
          rightElementsBuffer = [];
          leftKeyPrevious = checkOrder(leftKeyPrevious, leftKey, sortOrder);
          while (!rightElement.done) {
            const rightKey = rightKeyFn(rightElement.value);
            if (rightKey === undefined) {
              if (joinType === JoinType.RIGHT_DESC || joinType === JoinType.FULL_DESC ||
                  joinType == JoinType.RIGHT_ASC || joinType == JoinType.FULL_ASC) {
                yield joinResultFn(null, rightElement.value, null);
              }
            } else {
              rightKeyPrevious = checkOrder(rightKeyPrevious, rightKey, sortOrder);
              if ((sortOrder === SortOrder.DESC && safeCompare(leftKey, rightKey) < 0) ||
                  (sortOrder === SortOrder.ASC && safeCompare(leftKey, rightKey) > 0)) {
                if (joinType === JoinType.RIGHT_DESC || joinType === JoinType.FULL_DESC ||
                    joinType == JoinType.RIGHT_ASC || joinType == JoinType.FULL_ASC) {
                  yield joinResultFn(null, rightElement.value, rightKey);
                }
              } else if (safeCompare(leftKey, rightKey) == 0) {
                rightElementsBuffer.push(rightElement.value);
                // we should keep going and yield a list after this loop
              } else {
                // leftKey > rightKey if DESC (or < if ASC)
                break;
              }
            }
            rightElement = rightIter.next();
          }
        }
        if (rightElementsBuffer.length > 0) {
          for (const right of rightElementsBuffer) {
            yield joinResultFn(left, right, leftKey);
          }
        } else {
          if (joinType == JoinType.LEFT_DESC || joinType == JoinType.FULL_DESC ||
              joinType == JoinType.LEFT_ASC || joinType == JoinType.FULL_ASC) {
            yield  joinResultFn(left, null, leftKey);
          }
        }
      }
      // right iterator may still have some elements left
      if (joinType == JoinType.RIGHT_DESC || joinType == JoinType.FULL_DESC ||
          joinType == JoinType.RIGHT_ASC || joinType == JoinType.FULL_ASC) {
        while (!rightElement.done) {
          yield joinResultFn(null, rightElement.value, rightKeyFn(rightElement.value));
          rightElement = rightIter.next();
        }
      }
    };

    return new Stream(generator);
  }

  /**
   * Mimics SQL GROUP BY operator. Groups elements with the same given key. Keys must be in a sorted order, otherwise
   * will raise an exception. Next element is emitted only once the element with the next key appears in the stream.
   * Example of usage:
   * ```
   * const ungrouped = [{a: 1, b: "val 1"}, {a: 1, b: "val 2"},
   *                    {a: 2, b: "val 3"}, {a: 2, b: "val 4"}];
   * const grouped = new Stream(ungrouped)
   *   .groupBy("a")
   *   .toArray();
   *
   * expect(grouped).toStrictEqual([
   *   {key: 1, values: [{a: 1, b: "val 1"}, {a: 1, b: "val 2"}]},
   *   {key: 2, values: [{a: 2, b: "val 3"}, {a: 2, b: "val 4"}]}
   * ]);
   * ```
   * @param keyFieldOrFn
   */
  public groupBy<K extends FieldOrFn<T> = never>(keyFieldOrFn?: K):
      Stream<{ key: Val<T, K>, values: T[] }> {
    const _this = this;
    const calcKeyFn = createKeyFn<T, K>(keyFieldOrFn);
    const generator = function* () {
      let currentKey: Val<T, K> | undefined = undefined;
      let currentBucket: T[] = [];
      for (const currentElement of _this.$internal) {
        const newKey: Val<T, K> = calcKeyFn(currentElement);
        if (safeCompare(newKey, currentKey) == 0) {
          currentBucket.push(currentElement);
        } else {
          if (currentBucket.length > 0) {
            yield {
              key: currentKey as Val<T, K>, // [unsafe] if currentBucket is not empty we know currentKey was assigned
              values: currentBucket
            };
          }
          currentKey = newKey;
          currentBucket = [currentElement];
        }
      }
      if (currentBucket.length > 0) {
        yield {
          key: currentKey as Val<T, K>, // [unsafe] if currentBucket is not empty we know currentKey was assigned
          values: currentBucket
        };
      }
    };
    return new Stream(generator);
  }

  // --------------------------------------
  // Collectors / finalizers
  // --------------------------------------

  /**
   * Fetches all elements from the stream and executes given function for each element.
   * Example of usage:
   * ```
   * var sum = 0;
   * new Stream([1, 2, 3])
   *   .forEach(v => sum += v);
   *
   * expect(sum).toStrictEqual(6);
   * ```
   * @param fn function to invoke
   */
  public forEach(fn: Fn<T>): void {
    for (const t of this.$internal) {
      fn(t);
    }
  }

  /**
   * Fetches all elements from the stream and collect them int `Array<T>`.
   */
  public toArray(): Array<T> {
    if (this.$internal instanceof Array) {
      return this.$internal;
    }
    const result: Array<T> = [];
    for (let v of this.$internal) {
      result.push(v);
    }
    return result;
  }

  /**
   * Fetches all elements from the stream and collect them int `Map<K, V>`.
   * Example of usage:
   * ```
   * const result = new Stream([1, 2, 3]) .toMap(t => `${t}`);
   *
   * expect(result).toStrictEqual(new Map([['1', 1], ['2', 2], ['3', 3]]));
   * ```
   * @param key key field or function
   * @param val value field or function
   */
  public toMap<K extends FieldOrFn<T>, V extends FieldOrFn<T>>(key: K, val?: V): Map<Val<T, K>, Val<T, V>> {
    const keyFn = createKeyFn<T, K>(key);
    const valFn = createKeyFn<T, V>(val);
    const result = new Map<Val<T, K>, Val<T, V>>();
    for (let v of this.$internal) {
      result.set(keyFn(v), valFn(v));
    }
    return result;
  }

  // Reducers

  /**
   * Fetches all elements from the stream and recursively applies `reduceFn` to each element providing previous result
   * to each call.
   * Example of usage:
   * ```
   * const result = new Stream([1, 2, 3])
   *  .reduce<number>((a, b) => (a === undefined ? 0 : a) + b);
   *
   * expect(result).toStrictEqual(6);
   * ```
   * @param reduceFn function(accumulator: R | undefined, current: T, index: number) => R
   */
  public reduce<R>(reduceFn: (accumulator: R | undefined, current: T, index: number) => R): R {
    let result: R | undefined = undefined;
    let index = 0;
    for (const t of this.$internal) {
      result = reduceFn(result, t, index++);
    }
    if (result === undefined) {
      throw new Error("Initial value is not provided and stream is empty, at least either of theee must be false");
    }
    return result;
  }

  /**
   * Fetches all elements from the stream and returns the last element.
   * Example of usage:
   * ```
   * const result = new Stream([1, 2, 3]).last();
   * expect(result).toStrictEqual(3);
   * ```
   */
  public last(): T {
    return this.reduce((accumulator, current) => current);
  }

  /**
   * Fetches all elements from the stream and returns the minimal one.
   * Example of usage:
   * ```
   * const result = new Stream([1, 2, 3]).min();
   * expect(result).toStrictEqual(1);
   * ```
   * Currently only supports numeric streams, proper comparator support be added soon.
   */
  public min(this: Stream<number>): number {
    return this.reduce((accumulator, current) => Math.min(accumulator ?? Number.POSITIVE_INFINITY, current));
  }

  /**
   * Fetches all elements from the stream and returns the maximal one.
   * Example of usage:
   * ```
   * const result = new Stream([1, 2, 3]).max();
   * expect(result).toStrictEqual(3);
   * ```
   * Currently only supports numeric streams, proper comparator support to be added soon.
   */
  public max(this: Stream<number>): number {
    return this.reduce((accumulator, current) => Math.max(accumulator ?? Number.NEGATIVE_INFINITY, current));
  }
}

// ----------------------------------------
// Private types and functions
// ----------------------------------------

enum SortOrder {
  DESC = 0, ASC = 1
}

// generic key extractor function creator
function createKeyFn<T, K extends FieldOrFn<T>>(key?: K): (t: T) => Val<T, K> {
  // function
  if (typeof key == "function") {
    return key as Fn<T>; // [safe] should be inferred
  }
  // undefined
  if (key == undefined) {
    return (t => t as Val<T, K>); // [safe] should be inferred
  }
  // single field
  return (t: T) => t[key as Field<T>] as Val<T, K>; // [safe] should be inferred
}

// create join result function creator
function createJoinEntryFn<T, O, JT extends JoinType, L, R>(joinType: JoinType):
    (t: T | null, o: O | null, k: any) => JoinEntry<T, O, JT> {
  return (t: T | null, o: O | null, k: any) => {
    switch (joinType) {
      case JoinType.LEFT_DESC:
      case JoinType.INNER_DESC:
        if (!t) {
          throw new Error("null passed as left value for JoinType.INNER or JoinType.LEFT");
        }
        if (joinType == JoinType.INNER_DESC && !o) {
          throw new Error("null passed as right value for JoinType.INNER");
        }
        break;
      case JoinType.FULL_DESC:
      case JoinType.RIGHT_DESC:
        if (joinType == JoinType.RIGHT_DESC && o == undefined) {
          throw new Error("null passed as right value for JoinType.RIGHT");
        }
        break;
    }
    return {
      key: k,
      left: t,
      right: o
    } as JoinEntry<T, O, JT> // [unsafe] we prevent all bad cases in advance
  };
}

function checkOrder<K>(keyPrev: K | undefined, keyNext: K, sortOrder: SortOrder): K {
  if (keyPrev === undefined || keyNext === undefined) {
    return keyNext;
  }
  if (safeCompare(keyPrev, keyNext) > 0 && sortOrder == SortOrder.ASC) {
    throw new Error(`Sort order is ASC but ${keyPrev} > ${keyNext}`);
  }
  if (safeCompare(keyPrev, keyNext) < 0 && sortOrder == SortOrder.DESC) {
    throw new Error(`Sort order is DESC but ${keyPrev} < ${keyNext}`);
  }
  return keyNext;
}

function safeCompare(left: any, right: any): number {
  if (left === undefined || right === undefined) {
    if (right === undefined) {
      return 1; // left any > right undefined
    }
    return -1; // left undefined < right non-undefined
  }
  if (left === null || right === null) {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (!(typeof left in set("number", "string", "boolean"))) {
    throw new Error(`Type of left key (${typeof left}) must be 'number', 'string' or 'boolean'`);
  }
  if (typeof left != typeof right) {
    throw new Error(`Type of keys are different (${left}: ${typeof left} != ${right}:${typeof right} )`);
  }
  return left < right ? -1 : left > right ? 1 : 0;
}

function set<T extends string | number>(...arr: (string | number) []): {} {
  let obj: any = {};
  for (const e of arr) {
    obj[e] = null;
  }
  return obj;
}

function last<T>(thi: Array<T>): T | null {
  if (thi.length == 0) {
    return null;
  }
  return thi[thi.length - 1];
}

function isEmpty<T>(thi: Array<T>) {
  return thi.length === 0;
}

function groupBy<T, K extends FieldOrFn<T> = never>(thi: Array<T>, keyFieldOrFn?: K):
    Map<Val<T, K>, T[]> {
  const keyFn = createKeyFn<T, K>(keyFieldOrFn);
  return new Stream(thi.sort((a, b) => safeCompare(keyFn(a), keyFn(b))))
      .groupBy(keyFieldOrFn)
      .toMap("key", "values");
}