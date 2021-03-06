import * as firebase from 'firebase-admin';

export type TestCase = (event) => any
export type TestCaseMap = { [key: string]: TestCase };

export class TestSuite {
  private name: string;
  private tests: TestCaseMap;

  constructor(name: string, tests: TestCaseMap = {}) {
    this.name = name;
    this.tests = tests;
  }

  it(name: string, testCase: TestCase): TestSuite {
    this.tests[name] = testCase;
    return this;
  }

  run(testId: string, event): Promise<void> {
    let running: Array<Promise<any>> = [];
    for (let testName in this.tests) {
      if (!this.tests.hasOwnProperty(testName)) { continue; }
      const run = Promise.resolve()
        .then(() => this.tests[testName](event))
        .then(
        (result) => {
          console.log(`${result ? 'Passed' : 'Failed with successful op'}: ${testName}`);
          return { name: testName, passed: !!result };
        },
        (error) => {
          console.error(`Failed: ${testName}`, error);
          return { name: testName, passed: 0, error: error };
        }
        );
      running.push(run);
    }
    return Promise.all(running).then((results) => {
      let sum = 0;
      results.forEach((val) => sum = sum + val.passed);
      const summary = `passed ${sum} of ${running.length}`;
      console.log(summary);
      const result = { summary, tests: results };
      return firebase.database().ref(`testRuns/${testId}/${this.name}`).set(result);
    }).then(() => null);
  }
}

function success() {
  return Promise.resolve().then(() => true);
}

function failure(reason: string) {
  return Promise.reject(reason);
}

export function evaluate(value, errMsg) {
  if (value) {
    return success();
  }
  return failure(errMsg);
}

export function expectEq(left, right) {
  return evaluate(
    left === right,
    JSON.stringify(left) + ' does not equal ' + JSON.stringify(right));
}

export function expectMatches(input: string, regexp) {
  return evaluate(
    input.match(regexp),
    "Input '" + input + "' did not match regexp '" + regexp + "'");
}

export function expectReject(f) {
  return function (event) {
    return Promise.resolve()
      .then(() => f(event))
      .then(
      () => {
        throw new Error('Test should have returned a rejected promise');
      },
      () => true, // A rejection is what we expected, and so is a positive result.
    );
  };
}
