// (C) Sergey Rassokhin, 2020

import {from, JoinType, range, Stream} from "../index";

test('filter', () => {
  const even = new Stream([1, 2, 3])
      .filter(i => i % 2 == 0)
      .toArray();
  expect(even).toStrictEqual([2]);
});

test('map', () => {
  const squares = new Stream([1, 2, 3])
      .map(i => i * i)
      .toArray();
  expect(squares).toStrictEqual([1, 4, 9]);
});

test('flat', () => {
  const result = new Stream([[1, 3], [2, 4]])
      .flat()
      .toArray();
  expect(result).toStrictEqual([1, 3, 2, 4]);
});

test('flatMap', () => {
  const result = new Stream([{numbers: [1, 3]}, {numbers: [2, 4]}])
      .flatMap("numbers")
      .toArray();
  expect(result).toStrictEqual([1, 3, 2, 4]);
});

test('reduce', () => {
  const result = new Stream([1, 2, 3])
      .reduce<number>((a, b) => (a === undefined ? 0 : a) + b);
  expect(result).toStrictEqual(6);
});

test('last', () => {
  const result = new Stream([1, 2, 3])
      .last();
  expect(result).toStrictEqual(3);
});

test('min', () => {
  const result = new Stream([1, 2, 3])
      .min();
  expect(result).toStrictEqual(1);
});

test('max', () => {
  const result = new Stream([1, 2, 3])
      .max();
  expect(result).toStrictEqual(3);
});

test('forEach', () => {
  var sum = 0;
  new Stream([1, 2, 3])
      .forEach(v => sum += v);
  expect(sum).toStrictEqual(6);
});

test('toMap', () => {
  const result = new Stream([1, 2, 3])
      .toMap(t => `${t}`);
  expect(result).toStrictEqual(new Map([['1', 1], ['2', 2], ['3', 3]]));
});

test('select', () => {
  const obj = {a: 1, b: "str", c: 3};
  const result = new Stream([obj])
      .select("a", "b")
      .toArray();
  // result is Stream<{a: number, b: string}>
  expect(result).toStrictEqual([{a: 1, b: "str"}]);
});

test('select (one field)', () => {
  const obj = {a: 1, b: "str", c: 3};
  const selected = new Stream([obj])
      .select("b")
      .toArray();
  // result is Stream<string>
  expect(selected).toStrictEqual(["str"]);
});

test('where', () => {
  const objs = [{a: 1, b: "val a", c: 3}, {a: 2, b: "val b", c: 4}, {a: 3, b: "val c", c: 4}];
  const result = new Stream(objs)
      .where("a", "<", 3)
      .where("b", "!=", "val a")
      .toArray();
  expect(result).toStrictEqual([{a: 2, b: "val b", c: 4}]);
});

test('join', () => {
  const collectionA = [{a: 1, b: "val 1",}, {a: 2, b: "val 2",}, {a: 3, b: "val 3",}];
  const collectionB = [{a: 1, b: "val a",}, {a: 2, b: "val b",}];
  const result = new Stream(collectionA)
      .join(collectionB, {joinType: JoinType.INNER_ASC, commonKey: "a"})
      .toArray();
  expect(result).toStrictEqual([
    {key: 1, left: {a: 1, b: "val 1"}, right: {a: 1, b: "val a"}},
    {key: 2, left: {a: 2, b: "val 2"}, right: {a: 2, b: "val b"}}
  ]);
});

test('groupBy', () => {
  let ungrouped = [{a: 1, b: "val 1",}, {a: 1, b: "val 2",}, {a: 2, b: "val 3",}, {a: 2, b: "val 4",}];
  const result = new Stream(ungrouped)
      .groupBy("a")
      .toArray();
  expect(result).toStrictEqual([
    {key: 1, values: [{a: 1, b: "val 1"}, {a: 1, b: "val 2"}]},
    {key: 2, values: [{a: 2, b: "val 3"}, {a: 2, b: "val 4"}]}
  ]);
});

test('range', () => {
  const result = range(0, 10)
      .toArray();
  expect(result).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('from', () => {
  const result = from([1, 2], [3, 4])
      .toArray();
  expect(result).toStrictEqual([[1, 3], [1, 4], [2, 3], [2, 4]]);
});






