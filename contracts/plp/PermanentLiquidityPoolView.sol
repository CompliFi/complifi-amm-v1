// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity 0.7.6;
pragma abicoder v2;

import '../IPool.sol';
import './IPermanentLiquidityPool.sol';
import './IDesignatedPoolRegistry.sol';
import '../libs/complifi/tokens/IERC20Metadata.sol';

contract PermanentLiquidityPoolView {

    struct Token {
        address self;
        uint256 totalSupply;
        uint8 decimals;
        uint256 userBalance;
    }

    struct DelegatedToken {
        address self;
        uint256 totalSupply;
        uint8 decimals;
        uint256 userBalance;
        uint256 poolBalance;
    }

    function getPoolInfo(address _plPool, address _sender)
        external
        view
        returns (
            address designatedPool,
            address newDesignatedPool,
            bool canBeRolledOver,
            address derivativeSpecification,
            address designatedPoolRegistry,
            Token memory plPoolToken,
            DelegatedToken memory designatedPoolToken
        )
    {
        IPermanentLiquidityPool plPool = IPermanentLiquidityPool(_plPool);
        derivativeSpecification = plPool.derivativeSpecification();
        designatedPoolRegistry = plPool.designatedPoolRegistry();

        designatedPool = plPool.designatedPool();
        newDesignatedPool = IDesignatedPoolRegistry(designatedPoolRegistry).getDesignatedPool(derivativeSpecification);

        canBeRolledOver = (
            designatedPool != newDesignatedPool &&
            block.timestamp >= IPool(designatedPool).derivativeVault().settleTime()
        );

        plPoolToken = Token(
            _plPool,
            IERC20(_plPool).totalSupply(),
            IERC20Metadata(_plPool).decimals(),
            _sender == address(0) ? 0 : IERC20(_plPool).balanceOf(_sender)
        );

        designatedPoolToken = DelegatedToken(
            designatedPool,
            IERC20(designatedPool).totalSupply(),
            IERC20Metadata(designatedPool).decimals(),
            _sender == address(0) ? 0 : IERC20(designatedPool).balanceOf(_sender),
            IERC20(designatedPool).balanceOf(_plPool)
        );
    }
}
