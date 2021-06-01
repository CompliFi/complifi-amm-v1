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

import '../Math.sol';
import '../Num.sol';

// Contract to wrap internal functions for testing

contract TMath is Math {
    function calc_toi(uint256 a) external pure returns (uint256) {
        return toi(a);
    }

    function calc_floor(uint256 a) external pure returns (uint256) {
        return floor(a);
    }

    function calc_add(uint256 a, uint256 b) external pure returns (uint256) {
        return add(a, b);
    }

    function calc_sub(uint256 a, uint256 b) external pure returns (uint256) {
        return sub(a, b);
    }

    function calc_subSign(uint256 a, uint256 b) external pure returns (uint256, bool) {
        return subSign(a, b);
    }

    function calc_mul(uint256 a, uint256 b) external pure returns (uint256) {
        return mul(a, b);
    }

    function calc_div(uint256 a, uint256 b) external pure returns (uint256) {
        return div(a, b);
    }

    function calc_powi(uint256 a, uint256 n) external pure returns (uint256) {
        return powi(a, n);
    }

    function calc_pow(uint256 base, uint256 exp) external pure returns (uint256) {
        return pow(base, exp);
    }

    function calc_powApprox(
        uint256 base,
        uint256 exp,
        uint256 precision
    ) external pure returns (uint256) {
        return powApprox(base, exp, precision);
    }
}
