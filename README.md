# LazyStream.TS

Inspired by Java 8 Streams and .NET LINQ, this small library provides an easy way to work with collections in FP-like 
and SQL-like styles. 

# Class: Stream <**T**>

Stream class that wraps `Iterable<T>` and provides most of the common FP-style operations like map, filter,
flatMap etc. as well as SQL-style select, where, join etc. Stream does also implement `Iterable<T>` so it can
wrap other stream, and since most of the operations return `Stream<T>`, the calls can be easily chained with each
other, for example:
```
const numbers: Array<number> = ...
const evenSquares = new Stream(numbers)
   .filter(v => v % 2 == 0)
   .map(v => v * v)
   .toArray();
```
Types can be primitives (as in the example above) but can also be Objects, so SQL-like instructions can be used:
```
const users: Array<{name: string, age: number, city: string}> = ...
const usersByCity = new Stream(users)
  .where("age", ">=", 25)
  .groupBy("city")
  .toArray();
```

## Type parameters

▪ **T**

Type of elements in the stream. Can be any type including Object, primitives, Iterable etc.

## Summary of operations

### FP-style
* filter
* map
* reduce
* flat
* flatMap

### SQL-style
* groupBy
* join
* select
* where

### Collectors
* forEach
* toArray
* toMap

### Shortcuts
* last
* max
* min

## Constructors

###  constructor

\+ **new Stream**(`iterableOrIteratorFactory`: Iterable‹T› | function): *Stream*

*Defined in [index.ts:149](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L149)*

Creates a new instance of Stream by wrapping existing `Iterable<T>` or just a function that returns
`Iterator<T>` (so generator function can be passed as well). For example:
```
// from Iterable<T>
const fromIterable = new Stream([1,2,3,4]);

// from () => Iterator<T>
function* generator() {
  yield 1;
  yield 2;
  yield 3;
}
const fromGenerator = new Stream(generator);
```

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`iterableOrIteratorFactory` | Iterable‹T› &#124; function | instance of `Iterable<T>` or () => `Iterator<T>`  |

**Returns:** *Stream*

## Methods

###  [Symbol.iterator]

▸ **[Symbol.iterator]**(): *Iterator‹T›*

*Defined in [index.ts:179](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L179)*

**Returns:** *Iterator‹T›*

___

###  filter

▸ **filter**(`predicate`: function): *Stream‹T›*

*Defined in [index.ts:210](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L210)*

Filters elements given a predicate function.
Example of usage:
```
const evens = new Stream([1, 2, 3])
  .filter(i => i % 2 == 0)
  .toArray();

expect(even).toStrictEqual([2]);
```

**Parameters:**

▪ **predicate**: *function*

function that accepts element and return true or false

▸ (`t`: T): *boolean*

**Parameters:**

Name | Type |
------ | ------ |
`t` | T |

**Returns:** *Stream‹T›*

___

###  flat

▸ **flat**(`this`: Stream‹Iterable‹any››): *Stream‹T extends Iterable<infer E> ? E : never›*

*Defined in [index.ts:238](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L238)*

Flattens elements of this `Stream<Iterable<T>>` into `Stream<T>`.
Example of usage:
```
const flattened = new Stream([[1,3], [2,4]])
   .flat()
   .toArray();

expect(flattened).toStrictEqual([1, 3, 2, 4]);
```

**Parameters:**

Name | Type |
------ | ------ |
`this` | Stream‹Iterable‹any›› |

**Returns:** *Stream‹T extends Iterable<infer E> ? E : never›*

___

###  flatMap

▸ **flatMap**<**K**>(`field`: K): *Stream‹Val<T, K> extends Iterable<infer E> ? E : never›*

*Defined in [index.ts:259](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L259)*

First maps elements of `Stream<T>` to `Stream<Iterable<R>>` and then flattens into `Stream<R>`. For example:
```
const flattened = new Stream([{numbers: [1, 3]}, {numbers: [2, 4]}])
  .flatMap("numbers") 
  .toArray();
// "numbers" - name of a field that contains Iterable

expect(flattened).toStrictEqual([1, 3, 2, 4]);
```

**Type parameters:**

▪ **K**: *FieldOrFn‹T›*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`field` | K | field extractor see `FieldOrFn<T>`  |

**Returns:** *Stream‹Val<T, K> extends Iterable<infer E> ? E : never›*

___

###  forEach

▸ **forEach**(`fn`: Fn‹T›): *void*

*Defined in [index.ts:562](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L562)*

Fetches all elements from the stream and executes given function for each element.
Example of usage:
```
var sum = 0;
new Stream([1, 2, 3])
  .forEach(v => sum += v);

expect(sum).toStrictEqual(6);
```

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`fn` | Fn‹T› | function to invoke  |

**Returns:** *void*

___

###  groupBy

▸ **groupBy**<**K**>(`keyFieldOrFn?`: K): *Stream‹object›*

*Defined in [index.ts:516](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L516)*

Mimics SQL GROUP BY operator. Groups elements with the same given key. Keys must be in a sorted order, otherwise
will raise an exception. Next element is emitted only once the element with the next key appears in the stream.
Example of usage:
```
const ungrouped = [{a: 1, b: "val 1"}, {a: 1, b: "val 2"}, 
                   {a: 2, b: "val 3"}, {a: 2, b: "val 4"}];
const grouped = new Stream(ungrouped)
  .groupBy("a")
  .toArray();

expect(grouped).toStrictEqual([
  {key: 1, values: [{a: 1, b: "val 1"}, {a: 1, b: "val 2"}]},
  {key: 2, values: [{a: 2, b: "val 3"}, {a: 2, b: "val 4"}]}
]);
```

**Type parameters:**

▪ **K**: *FieldOrFn‹T›*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`keyFieldOrFn?` | K |   |

**Returns:** *Stream‹object›*

___

###  join

▸ **join**<**O**, **KC**, **KL**, **KR**, **JT**>(`other`: Iterable‹O›, `params`: object): *Stream‹JoinEntry‹T, O, JT››*

*Defined in [index.ts:369](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L369)*

Mimics SQL JOIN operator. Depending on type of join, for each element of source stream lookups a corresponding
element from joined stream, using join parameter that can either be a field, or a function.

If using SORTED join type, it will ensure that keys from both set come in the specified order, otherwise will
raise an exception. This is the most intended usage of this operation as it won't need to pre-fetch all elements
from second stream in memory. The output keys order is preserved, i.e. if join order is ascending, then join entries 
will be emitted with the keys being in ascending order. 

If using UNSORTED join type, it will pre-fetch all elements from second stream into a hash map before any join
entries can be emitted.

Keys are not required to be unique, for duplicate keys, join entries will be multiplied, like it happens in SQL:
```
[1,2,2] left join [2,2,3] = [{1,null}, {2,2}, {2,2}, {2,2}, {2,2}]
```
Example of usage:
```
let collectionA = [{a: 1, b: "val 1",}, {a: 2, b: "val 2",}, {a: 3, b: "val 3",}];
let collectionB = [{a: 1, b: "val a",}, {a: 2, b: "val b",}];
const joined = new Stream(collectionA)
  .join(collectionB, {joinType: JoinType.INNER_ASC, commonKey: "a"})
  .toArray();

expect(result).toStrictEqual([
  {key: 1, left: {a: 1, b: "val 1"}, right: {a: 1, b: "val a"}},
  {key: 2, left: {a: 2, b: "val 2"}, right: {a: 2, b: "val b"}}
]);
```

**Type parameters:**

▪ **O** - type of elements in the other stream being joined 

**Parameters:**

▪ **other**: *Iterable‹O›* - other stream to join (right-side)

▪ **params**: `Optional` *object*= `{joinType?, commonKey?, leftKey?, rightKey?}`  

Name | Type | Description |
------ | ------------ | ----------------------- |
`commonKey?` | *FieldOrFn‹T &#124; O›* | Common field that belongs to both streams elements, or a function that can extract key from *T &#124; O*; if provided, next 2 will be ignored. |
`leftKey?` | *FieldOrFn‹O›* | Field that belongs to current (left) stream elements, or a function that can extract key from `T`. If not provided, then elements will be used as keys and are supposed to be primitive.  |
`rightKey?` | *JoinType* | Field that belongs to other (right) stream elements, or a function that can extract key from `O`. If not provided, then elements will be used as keys and are supposed to be primitive. |
`joinType?` | *FieldOrFn‹T›* | Join mode, default value is `JoinType.INNER_ASC`. |
 
 *JoinType* is defining a semantic of a join operation as follows:
    
JoinType |  Left  | Right | Result |
-------- |  ------- | ---- | ----| 
INNER_ASC | `[1,2]` | `[2,3]` | `[{key: 2, left: 2, right: 2}]` |
LEFT_ASC | `[1,2]` | `[2,3]` | `[{key: 1, left: 2, right: null}, {key: 2, left: 2, right: 2}]` |
RIGHT_ASC | `[1,2]` | `[2,3]` | `[{key: 2, left: 2, right: 2}, {key: 3, left: null, right: 3}]` |
FULL_ASC | `[1,2]` | `[2,3]` | `[{key: 1, left: 1, right: null}, {key: 2, left: 2, right: 2}, {key: 3, left: null, right: 3}]` |
INNER_DESC | `[2,1]` | `[3,2]` | `[{key: 2, left: 2, right: 2}]` |
LEFT_DESC | `[2,1]` | `[3,2]` | `[{key: 2, left: 2, right: 2}, {key: 1, left: 2, right: null}]` |
RIGHT_DESC | `[2,1]` | `[3,2]` | `[{key: 3, left: 3, right: null}, {key: 2, left: 2, right: 2}]` |
FULL_DESC | `[2,1]` | `[3,2]` | `[{key: 3, left: 3, right: null}, {key: 2, left: 2, right: 2}, {key: 1, left: 2, right: null}]` |
INNER_UNSORTED | `[1,3,2]`  | `[2,1,4]` | `[{key: 1, left: 2, right: 1}, {key: 2, left: 2, right: 2}]` 
LEFT_UNSORTED | `[1,3,2]`  | `[2,1,4]` | `[{key: 1, left: 2, right: 1}, {key: 3, left: null, right: 3}, {key: 2, left: 2, right: 2}]`
 
**Returns:** *[Stream](_index_.stream.md)‹JoinEntry‹T, O, JT››*
___

###  last

▸ **last**(): *T*

*Defined in [index.ts:638](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L638)*

Fetches all elements from the stream and returns the last element.
Example of usage:
```
const result = new Stream([1, 2, 3]).last();
expect(result).toStrictEqual(3);
```

**Returns:** *T*

___

###  map

▸ **map**<**R**>(`mapFn`: function): *Stream‹R›*

*Defined in [index.ts:225](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L225)*

Maps each element of a current stream with a mapper function and returns new Stream of newly created elements.
Example of usage:
```
const squares = new Stream([1, 2, 3])
  .map(i => i * i)
  .toArray();
```

**Type parameters:**

▪ **R**

**Parameters:**

▪ **mapFn**: *function*

function that accepts current element and returns a new one. The function can optionally accept prev
element (original and mapped one).

▸ (`t`: T, `prevT?`: T, `prevR?`: R): *R*

**Parameters:**

Name | Type |
------ | ------ |
`t` | T |
`prevT?` | T |
`prevR?` | R |

**Returns:** *Stream‹R›*

___

###  max

▸ **max**(`this`: Stream‹number›): *number*

*Defined in [index.ts:664](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L664)*

Fetches all elements from the stream and returns the maximal one.
Example of usage:
```
const result = new Stream([1, 2, 3]).max();
expect(result).toStrictEqual(3);
```
Currently only supports numeric streams, proper comparator support to be added soon.

**Parameters:**

Name | Type |
------ | ------ |
`this` | Stream‹number› |

**Returns:** *number*

___

###  min

▸ **min**(`this`: Stream‹number›): *number*

*Defined in [index.ts:651](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L651)*

Fetches all elements from the stream and returns the minimal one.
Example of usage:
```
const result = new Stream([1, 2, 3]).min();
expect(result).toStrictEqual(1);
```
Currently only supports numeric streams, proper comparator support be added soon.

**Parameters:**

Name | Type |
------ | ------ |
`this` | Stream‹number› |

**Returns:** *number*

___

###  reduce

▸ **reduce**<**R**>(`reduceFn`: function): *R*

*Defined in [index.ts:618](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L618)*

Fetches all elements from the stream and recursively applies `reduceFn` to each element providing previous result
to each call.
Example of usage:
```
const result = new Stream([1, 2, 3])
 .reduce<number>((a, b) => (a === undefined ? 0 : a) + b);

expect(result).toStrictEqual(6);
```

**Type parameters:**

▪ **R**

**Parameters:**

▪ **reduceFn**: *function*

function(accumulator: R | undefined, current: T, index: number) => R

▸ (`accumulator`: R | undefined, `current`: T, `index`: number): *R*

**Parameters:**

Name | Type |
------ | ------ |
`accumulator` | R &#124; undefined |
`current` | T |
`index` | number |

**Returns:** *R*

___

###  select

▸ **select**<**U1**, **U2**>(`field1`: U1, ...`field2`: U2[]): *Stream‹[U2] extends [never] ? T[U1] : object›*

*Defined in [index.ts:283](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L283)*

Mimics SQL SELECT operator, by restricting set of fields that need be returned. Accepts list of field names, and
returns objects with only those fields, for example:
```
const selectedAB = stream([{a: 1, b: "str", c: 3}]).select("a", "b");
const selectedA = stream([{a: 1, b: "str", c: 3}]).select("a");

expect(selectedAB).toStrictEqual([{a: 1, b: "str"}]);
expect(selectedA).toStrictEqual([1]);
```

**Type parameters:**

▪ **U1**: *Field‹T›*

▪ **U2**: *Field‹T›*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`field1` | U1 | field name |
`...field2` | U2[] | field name (none or many)  |

**Returns:** *Stream‹[U2] extends [never] ? T[U1] : object›*

___

###  toArray

▸ **toArray**(): *Array‹T›*

*Defined in [index.ts:571](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L571)*

Fetches all elements from the stream and collect them int `Array<T>`.

**Returns:** *Array‹T›*

___

###  toMap

▸ **toMap**<**K**, **V**>(`key`: K, `val?`: V): *Map‹Val‹T, K›, Val‹T, V››*

*Defined in [index.ts:594](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L594)*

Fetches all elements from the stream and collect them int `Map<K, V>`.
Example of usage:
```
const result = new Stream([1, 2, 3])
  .toMap(t => `${t}`);

expect(result).toStrictEqual(new Map([['1', 1], ['2', 2], ['3', 3]]));
```

**Type parameters:**

▪ **K**: *FieldOrFn‹T›*

▪ **V**: *FieldOrFn‹T›*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`key` | K | key field or function |
`val?` | V | value field or function  |

**Returns:** *Map‹Val‹T, K›, Val‹T, V››*

___

###  where

▸ **where**<**K**>(`field`: K, `compareOp`: ComparisonOp, `value`: Val‹T, K›): *Stream‹T›*

*Defined in [index.ts:314](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L314)*

Mimics SQL WHERE clause, by including only the records that satisfy given parameters.
Example of usages:
```
const objs = [{a: 1, b: "val a", c: 3}, {a: 2, b: "val b", c: 4}, 
              {a: 3, b: "val c", c: 4}];
const result = new Stream(objs)
  .where("a", "<", 3)
  .where("b", "!=", "val a")
  .toArray();

expect(result).toStrictEqual([{a: 2, b: "val b", c: 4}]);
```

**Type parameters:**

▪ **K**: *FieldOrFn‹T›*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`field` | K | field name, see `Field<T>` |
`compareOp` | ComparisonOp | comparison operation, see `ComparisonOp` |
`value` | Val‹T, K› | value of type `T[Field]` to compare with  |

**Returns:** *Stream‹T›*

# Creating streams from existing collections

##  from

▸ **from**<**T**>(`first`: Iterable‹T›, `second`: Iterable‹T›, ...`rest`: Iterable‹T›[]): *Stream‹T[]›*

*Defined in [index.ts:21](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L21)*

Cross-multiplies multiple `Iterable's` of the same type T into `Stream<T[]>`. Can accept any number of args.
This function can be used as a shortcut - `from(someIterable)` instead of `new Stream(someIterable)`.

Example of usage:
```
const result = from([1, 3], [2, 4])
  .toArray();

expect(result).toStrictEqual([[1, 3], [1, 4], [2, 3], [2, 4]]);
```

**Type parameters:**

▪ **T**

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`first` | Iterable‹T› | (required) first *Iterable* |
`second` | Iterable‹T› | (optional) second *Iterable* |
`...rest` | Iterable‹T›[] | (optional) other *Iterables* |

**Returns:** *Stream‹T[]›*
___

##  range

▸ **range**(`from`: number, `to`: number): *Stream‹number›*

*Defined in [index.ts:60](https://github.com/sergeyrassokhin/lazystream.ts/blob/ea5d4c3/src/index.ts#L60)*

Creates a `Stream<number>` with all numbers from the range.
Example of usage:
```
const result = range(0, 10)
  .toArray();

expect(result).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
```

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`from` | number | start of range (inclusive) |
`to` | number | end of range (inclusive)  |

**Returns:** *Stream‹number›*

___