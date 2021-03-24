// "SPDX-License-Identifier: GNU General Public License v3.0"

pragma solidity 0.7.6;

import "./TPool.sol";
import "../IPoolBuilder.sol";

contract TPoolBuilder is IPoolBuilder{
    function buildPool(
        address controller,
        address derivativeVault,
        address feeCalculator,
        address repricer,
        uint baseFee,
        uint maxFee,
        uint feeAmp
    ) public override returns(address){
        TPool pool = new TPool(
            derivativeVault,
            feeCalculator,
            repricer,
            baseFee,
            maxFee,
            feeAmp,
            controller
        );
        pool.transferOwnership(msg.sender);
        return address(pool);
    }
}
