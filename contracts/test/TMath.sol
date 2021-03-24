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

import "../Math.sol";
import "../Num.sol";

// Contract to wrap internal functions for testing

contract TMath is Math {

    function calc_toi(uint a) external pure returns (uint) {
        return toi(a);
    }

    function calc_floor(uint a) external pure returns (uint) {
        return floor(a);
    }

    function calc_add(uint a, uint b) external pure returns (uint) {
        return add(a, b);
    }

    function calc_sub(uint a, uint b) external pure returns (uint) {
        return sub(a, b);
    }

    function calc_subSign(uint a, uint b) external pure returns (uint, bool) {
        return subSign(a, b);
    }

    function calc_mul(uint a, uint b) external pure returns (uint) {
        return mul(a, b);
    }

    function calc_div(uint a, uint b) external pure returns (uint) {
        return div(a, b);
    }

    function calc_powi(uint a, uint n) external pure returns (uint) {
        return powi(a, n);
    }

    function calc_pow(uint base, uint exp) external pure returns (uint) {
        return pow(base, exp);
    }

    function calc_powApprox(uint base, uint exp, uint precision) external pure returns (uint) {
        return powApprox(base, exp, precision);
    }
}
