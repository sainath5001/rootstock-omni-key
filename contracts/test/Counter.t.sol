// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Counter} from "../src/Counter.sol";

contract CounterTest is Test {
    Counter counter;

    function setUp() public {
        counter = new Counter();
    }

    function test_Increment() public {
        assertEq(counter.counter(), 0);
        counter.increment();
        assertEq(counter.counter(), 1);
        counter.increment();
        assertEq(counter.counter(), 2);
    }
}
