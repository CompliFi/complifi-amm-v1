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

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';
import './libs/complifi/tokens/IERC20Metadata.sol';
import './libs/complifi/tokens/EIP20NonStandardInterface.sol';
import './libs/complifi/tokens/TokenMetadataGenerator.sol';

import './Token.sol';
import './Math.sol';
import './repricers/IRepricer.sol';
import './IDynamicFee.sol';
import './libs/complifi/IVaultMinimal.sol';

contract Pool is Ownable, Pausable, Token, Math, TokenMetadataGenerator {

    struct Record {
        uint256 leverage;
        uint256 balance;
    }

    event LOG_SWAP(
        address indexed caller,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 tokenAmountIn,
        uint256 tokenAmountOut,
        uint256 fee,
        uint256 tokenBalanceIn,
        uint256 tokenBalanceOut,
        uint256 tokenLeverageIn,
        uint256 tokenLeverageOut
    );

    event LOG_JOIN(address indexed caller, address indexed tokenIn, uint256 tokenAmountIn);

    event LOG_EXIT(address indexed caller, address indexed tokenOut, uint256 tokenAmountOut);

    event LOG_REPRICE(
        uint256 repricingBlock,
        uint256 balancePrimary,
        uint256 balanceComplement,
        uint256 leveragePrimary,
        uint256 leverageComplement,
        uint256 newLeveragePrimary,
        uint256 newLeverageComplement,
        int256 estPricePrimary,
        int256 estPriceComplement,
        int256 liveUnderlingValue
    );

    event LOG_SET_FEE_PARAMS(
        uint256 baseFee,
        uint256 maxFee,
        uint256 feeAmpPrimary,
        uint256 feeAmpComplement
    );

    event LOG_FINALIZE(
        address _swappableController,
        uint256 _primaryBalance,
        uint256 _primaryLeverage,
        uint256 _complementBalance,
        uint256 _complementLeverage,
        uint256 _exposureLimitPrimary,
        uint256 _exposureLimitComplement,
        uint256 _pMin,
        uint256 _qMin,
        uint256 _repricerParam1,
        uint256 _repricerParam2
    );

    event LOG_CALL(bytes4 indexed sig, address indexed caller, bytes data) anonymous;

    modifier _logs_() {
        emit LOG_CALL(msg.sig, msg.sender, msg.data);
        _;
    }

    modifier _lock_() {
        requireLock();
        _mutex = true;
        _;
        _mutex = false;
    }

    modifier _viewlock_() {
        requireLock();
        _;
    }

    modifier onlyFinalized() {
        require(_finalized, 'FIN');
        _;
    }

    modifier onlyController() {
        require(msg.sender == controller, 'CONTR');
        _;
    }

    modifier onlySwappable() {
        require(swappable, 'SWAP');
        _;
    }

    modifier onlyLiveDerivative() {
        require(block.timestamp < derivativeVault.settleTime(), 'SETTLED');
        _;
    }

    function requireLock() internal view {
        require(!_mutex, 'REENTRY');
    }

    bool private _mutex;

    address public controller;

    bool private _finalized;
    bool public swappable;

    uint256 public constant BOUND_TOKENS = 2;
    address[BOUND_TOKENS] private _tokens;
    mapping(address => Record) internal _records;

    uint256 public repricingBlock;
    uint256 public upperBoundary;

    uint256 public baseFee;
    uint256 public feeAmpPrimary;
    uint256 public feeAmpComplement;
    uint256 public maxFee;

    uint256 public pMin;
    uint256 public qMin;
    uint256 public exposureLimitPrimary;
    uint256 public exposureLimitComplement;
    uint256 public repricerParam1;
    uint256 public repricerParam2;

    IVaultMinimal public derivativeVault;
    IDynamicFee public dynamicFee;
    IRepricer public repricer;

    constructor(
        address _derivativeVault,
        address _dynamicFee,
        address _repricer,
        address _controller
    ) public {
        require(_derivativeVault != address(0));
        derivativeVault = IVaultMinimal(_derivativeVault);

        require(_dynamicFee != address(0));
        dynamicFee = IDynamicFee(_dynamicFee);

        require(_repricer != address(0));
        repricer = IRepricer(_repricer);

        require(_controller != address(0));
        controller = _controller;

        string memory settlementDate = formatDate(derivativeVault.settleTime());

        setName(
            makeTokenName(derivativeVault.derivativeSpecification().name(), settlementDate, ' LP')
        );
        setSymbol(
            makeTokenSymbol(
                derivativeVault.derivativeSpecification().symbol(),
                settlementDate,
                '-LP'
            )
        );
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function isFinalized() external view returns (bool) {
        return _finalized;
    }

    function getTokens() external view _viewlock_ returns (address[BOUND_TOKENS] memory tokens) {
        return _tokens;
    }

    function getLeverage(address token) external view _viewlock_ returns (uint256) {
        return _records[token].leverage;
    }

    function getBalance(address token) external view _viewlock_ returns (uint256) {
        return _records[token].balance;
    }

    function setFeeParams(
        uint256 _baseFee,
        uint256 _maxFee,
        uint256 _feeAmpPrimary,
        uint256 _feeAmpComplement
    ) external _logs_ _lock_ onlyController onlyLiveDerivative {
        require(!_finalized, 'FIN');

        baseFee = _baseFee;
        maxFee = _maxFee;
        feeAmpPrimary = _feeAmpPrimary;
        feeAmpComplement = _feeAmpComplement;

        emit LOG_SET_FEE_PARAMS(_baseFee, _maxFee, _feeAmpPrimary, _feeAmpComplement);
    }

    function finalize(
        address _swappableController,
        uint256 _primaryBalance,
        uint256 _primaryLeverage,
        uint256 _complementBalance,
        uint256 _complementLeverage,
        uint256 _exposureLimitPrimary,
        uint256 _exposureLimitComplement,
        uint256 _pMin,
        uint256 _qMin,
        uint256 _repricerParam1,
        uint256 _repricerParam2
    ) external _logs_ _lock_ onlyController onlyLiveDerivative {
        require(!_finalized, 'FIN');

        require(_primaryBalance == _complementBalance, 'SYM');

        require(baseFee > 0, 'FEE');

        pMin = _pMin;
        qMin = _qMin;
        exposureLimitPrimary = _exposureLimitPrimary;
        exposureLimitComplement = _exposureLimitComplement;
        repricerParam1 = _repricerParam1;
        repricerParam2 = _repricerParam2;

        _finalized = true;

        bind(0, address(derivativeVault.primaryToken()), _primaryBalance, _primaryLeverage);
        bind(
            1,
            address(derivativeVault.complementToken()),
            _complementBalance,
            _complementLeverage
        );

        uint256 initPoolSupply = (derivativeVault.derivativeSpecification().primaryNominalValue() +
        derivativeVault.derivativeSpecification().complementNominalValue()) * _primaryBalance;

        uint256 collateralDecimals =
        uint256(IERC20Metadata(address(derivativeVault.collateralToken())).decimals());
        if (collateralDecimals >= 0 && collateralDecimals < 18) {
            initPoolSupply = initPoolSupply * (10**(18 - collateralDecimals));
        }

        _mintPoolShare(initPoolSupply);
        _pushPoolShare(msg.sender, initPoolSupply);

        if(_swappableController == address(0)) {
            swappable = true;
            controller = address(0);
        } else {
            controller = _swappableController;
        }

        emit LOG_FINALIZE(
            _swappableController,
            _primaryBalance,
            _primaryLeverage,
            _complementBalance,
            _complementLeverage,
            _exposureLimitPrimary,
            _exposureLimitComplement,
            _pMin,
            _qMin,
            _repricerParam1,
            _repricerParam2
        );
    }

    function setSwappable() external _logs_ _lock_ onlyController onlyFinalized {
        swappable = true;
    }

    function bind(
        uint256 index,
        address token,
        uint256 balance,
        uint256 leverage
    ) internal {
        require(balance >= qMin, 'BAL');
        require(leverage > 0, 'LEV');

        _records[token] = Record({ leverage: leverage, balance: balance });

        _tokens[index] = token;

        _pullUnderlying(token, msg.sender, balance);
    }

    function joinPool(uint256 poolAmountOut, uint256[2] calldata maxAmountsIn)
        external
        _logs_
        _lock_
        onlyFinalized
    {
        uint256 poolTotal = totalSupply();
        uint256 ratio = div(poolAmountOut, poolTotal);
        require(ratio != 0, 'APPR');

        for (uint256 i = 0; i < BOUND_TOKENS; i++) {
            address token = _tokens[i];
            uint256 bal = _records[token].balance;
            require(bal > 0, 'BAL');
            uint256 tokenAmountIn = mul(ratio, bal);
            require(tokenAmountIn <= maxAmountsIn[i], 'LIMIN');
            _records[token].balance = add(_records[token].balance, tokenAmountIn);
            emit LOG_JOIN(msg.sender, token, tokenAmountIn);
            _pullUnderlying(token, msg.sender, tokenAmountIn);
        }

        _mintPoolShare(poolAmountOut);
        _pushPoolShare(msg.sender, poolAmountOut);
    }

    function exitPool(uint256 poolAmountIn, uint256[2] calldata minAmountsOut)
        external
        _logs_
        _lock_
        onlyFinalized
    {
        uint256 poolTotal = totalSupply();
        uint256 ratio = div(poolAmountIn, poolTotal);
        require(ratio != 0, 'APPR');

        _pullPoolShare(msg.sender, poolAmountIn);
        _burnPoolShare(poolAmountIn);

        for (uint256 i = 0; i < BOUND_TOKENS; i++) {
            address token = _tokens[i];
            uint256 bal = _records[token].balance;
            require(bal > 0, 'BAL');
            uint256 tokenAmountOut = mul(ratio, bal);
            require(tokenAmountOut >= minAmountsOut[i], 'LIMOUT');
            _records[token].balance = sub(_records[token].balance, tokenAmountOut);
            emit LOG_EXIT(msg.sender, token, tokenAmountOut);
            _pushUnderlying(token, msg.sender, tokenAmountOut);
        }
    }

    function reprice() internal virtual {
        if (repricingBlock == block.number) return;
        repricingBlock = block.number;

        Record storage primaryRecord = _records[_getPrimaryDerivativeAddress()];
        Record storage complementRecord = _records[_getComplementDerivativeAddress()];

        int256 estPricePrimary;
        int256 estPriceComplement;
        uint256 estPrice;
        (
            estPricePrimary,
            estPriceComplement,
            estPrice,
            upperBoundary
        ) =
            repricer.reprice(
                derivativeVault,
                pMin,
                int256(repricerParam1),
                int256(repricerParam2)
            );

        uint256 primaryRecordLeverageBefore = primaryRecord.leverage;
        uint256 complementRecordLeverageBefore = complementRecord.leverage;

        uint256 leveragesMultiplied = mul(primaryRecordLeverageBefore, complementRecordLeverageBefore);
        primaryRecord.leverage = uint256(
            repricer.sqrtWrapped(int256(div(mul(leveragesMultiplied, mul(complementRecord.balance, estPrice)), primaryRecord.balance)))
        );
        complementRecord.leverage = div(leveragesMultiplied, primaryRecord.leverage);

        emit LOG_REPRICE(
            repricingBlock,
            primaryRecord.balance,
            complementRecord.balance,
            primaryRecordLeverageBefore,
            complementRecordLeverageBefore,
            primaryRecord.leverage,
            complementRecord.leverage,
            estPricePrimary,
            estPriceComplement,
            derivativeVault.underlyingStarts(0)
        );
    }

    function calcFee(
        Record memory inRecord,
        uint256 tokenAmountIn,
        Record memory outRecord,
        uint256 tokenAmountOut,
        uint256 feeAmp
    ) internal returns (uint256 fee, int256 expStart) {
        int256 ifee;
        (ifee, expStart) = dynamicFee.calc(
            [int256(inRecord.balance), int256(inRecord.leverage), int256(tokenAmountIn)],
            [int256(outRecord.balance), int256(outRecord.leverage), int256(tokenAmountOut)],
            int256(baseFee),
            int256(feeAmp),
            int256(maxFee)
        );
        require(ifee > 0, 'BADFEE');
        fee = uint256(ifee);
    }

    function calcExpStart(int256 _inBalance, int256 _outBalance) internal pure returns (int256) {
        return ((_inBalance - _outBalance) * iBONE) / (_inBalance + _outBalance);
    }

    function performSwap(
        address tokenIn,
        uint256 tokenAmountIn,
        address tokenOut,
        uint256 tokenAmountOut,
        uint256 spotPriceBefore,
        uint256 fee
    ) internal returns (uint256 spotPriceAfter) {
        Record storage inRecord = _records[tokenIn];
        Record storage outRecord = _records[tokenOut];

        requireBoundaryConditions(
            inRecord,
            tokenAmountIn,
            outRecord,
            tokenAmountOut,
            _getPrimaryDerivativeAddress() == tokenIn ? exposureLimitPrimary : exposureLimitComplement
        );

        updateLeverages(inRecord, tokenAmountIn, outRecord, tokenAmountOut);

        inRecord.balance = add(inRecord.balance, tokenAmountIn);
        outRecord.balance = sub(outRecord.balance, tokenAmountOut);

        spotPriceAfter = calcSpotPrice(
            getLeveragedBalance(inRecord),
            getLeveragedBalance(outRecord),
            0
        );

        require(spotPriceAfter >= spotPriceBefore, 'APPR');
        require(spotPriceBefore <= div(tokenAmountIn, tokenAmountOut), 'APPROTHER');

        emit LOG_SWAP(
            msg.sender,
            tokenIn,
            tokenOut,
            tokenAmountIn,
            tokenAmountOut,
            fee,
            inRecord.balance,
            outRecord.balance,
            inRecord.leverage,
            outRecord.leverage
        );

        _pullUnderlying(tokenIn, msg.sender, tokenAmountIn);
        _pushUnderlying(tokenOut, msg.sender, tokenAmountOut);
    }

    function swapExactAmountIn(
        address tokenIn,
        uint256 tokenAmountIn,
        address tokenOut,
        uint256 minAmountOut
    )
        external
        _logs_
        _lock_
        whenNotPaused
        onlySwappable
        onlyFinalized
        onlyLiveDerivative
        returns (uint256 tokenAmountOut, uint256 spotPriceAfter)
    {
        require(tokenIn != tokenOut, 'SAME');
        require(tokenAmountIn >= qMin, 'MININ');

        reprice();

        Record memory inRecord = _records[tokenIn];
        Record memory outRecord = _records[tokenOut];

        tokenAmountOut = calcOutGivenIn(
            getLeveragedBalance(inRecord),
            getLeveragedBalance(outRecord),
            tokenAmountIn,
            0
        );

        uint256 fee;
        int256 expStart;
        (fee, expStart) = calcFee(
            inRecord,
            tokenAmountIn,
            outRecord,
            tokenAmountOut,
            _getPrimaryDerivativeAddress() == tokenIn ? feeAmpPrimary : feeAmpComplement
        );

        uint256 spotPriceBefore =
            calcSpotPrice(
                getLeveragedBalance(inRecord),
                getLeveragedBalance(outRecord),
                0
            );

        tokenAmountOut = calcOutGivenIn(
            getLeveragedBalance(inRecord),
            getLeveragedBalance(outRecord),
            tokenAmountIn,
            fee
        );
        require(tokenAmountOut >= minAmountOut, 'LIMOUT');

        spotPriceAfter = performSwap(
            tokenIn,
            tokenAmountIn,
            tokenOut,
            tokenAmountOut,
            spotPriceBefore,
            fee
        );
    }

    function getLeveragedBalance(Record memory r) internal pure returns (uint256) {
        return mul(r.balance, r.leverage);
    }

    function requireBoundaryConditions(
        Record storage inToken,
        uint256 tokenAmountIn,
        Record storage outToken,
        uint256 tokenAmountOut,
        uint exposureLimit
    ) internal view {
        require(sub(getLeveragedBalance(outToken), tokenAmountOut) > qMin, 'BLEV');
        require(sub(outToken.balance, tokenAmountOut) > qMin, 'BNONLEV');

        uint256 lowerBound = div(pMin, sub(upperBoundary, pMin));
        uint256 upperBound = div(sub(upperBoundary, pMin), pMin);
        uint256 value =
            div(
                add(getLeveragedBalance(inToken), tokenAmountIn),
                sub(getLeveragedBalance(outToken), tokenAmountOut)
            );

        require(lowerBound < value, 'BLOW');
        require(value < upperBound, 'BUP');

        (uint256 numerator, bool sign) = subSign(
            add(add(inToken.balance, tokenAmountIn), tokenAmountOut),
            outToken.balance
        );

        if(!sign) {
            uint256 denominator =
            sub(add(add(inToken.balance, tokenAmountIn), outToken.balance), tokenAmountOut);

            require(div(numerator, denominator) < exposureLimit, 'BEXP');
        }
    }

    function updateLeverages(
        Record storage inToken,
        uint256 tokenAmountIn,
        Record storage outToken,
        uint256 tokenAmountOut
    ) internal {
        outToken.leverage = div(
            sub(getLeveragedBalance(outToken), tokenAmountOut),
            sub(outToken.balance, tokenAmountOut)
        );
        require(outToken.leverage > 0, 'ZOUTLEV');

        inToken.leverage = div(
            add(getLeveragedBalance(inToken), tokenAmountIn),
            add(inToken.balance, tokenAmountIn)
        );
        require(inToken.leverage > 0, 'ZINLEV');
    }

    function _getPrimaryDerivativeAddress() internal view returns (address) {
        return _tokens[0];
    }

    function _getComplementDerivativeAddress() internal view returns (address) {
        return _tokens[1];
    }

    // ==
    // 'Underlying' token-manipulation functions make external calls but are NOT locked
    // You must `_lock_` or otherwise ensure reentry-safety

    function _pullPoolShare(address from, uint256 amount) internal {
        _pull(from, amount);
    }

    function _pushPoolShare(address to, uint256 amount) internal {
        _push(to, amount);
    }

    function _mintPoolShare(uint256 amount) internal {
        _mint(amount);
    }

    function _burnPoolShare(uint256 amount) internal {
        _burn(amount);
    }

    /// @dev Similar to EIP20 transfer, except it handles a False result from `transferFrom` and reverts in that case.
    /// This will revert due to insufficient balance or insufficient allowance.
    /// This function returns the actual amount received,
    /// which may be less than `amount` if there is a fee attached to the transfer.
    /// @notice This wrapper safely handles non-standard ERC-20 tokens that do not return a value.
    /// See here: https://medium.com/coinmonks/missing-return-value-bug-at-least-130-tokens-affected-d67bf08521ca
    function _pullUnderlying(
        address erc20,
        address from,
        uint256 amount
    ) internal returns (uint256) {
        uint256 balanceBefore = IERC20(erc20).balanceOf(address(this));
        EIP20NonStandardInterface(erc20).transferFrom(from, address(this), amount);

        bool success;
        assembly {
            switch returndatasize()
                case 0 {
                    // This is a non-standard ERC-20
                    success := not(0) // set success to true
                }
                case 32 {
                    // This is a compliant ERC-20
                    returndatacopy(0, 0, 32)
                    success := mload(0) // Set `success = returndata` of external call
                }
                default {
                    // This is an excessively non-compliant ERC-20, revert.
                    revert(0, 0)
                }
        }
        require(success, 'TINFAIL');

        // Calculate the amount that was *actually* transferred
        uint256 balanceAfter = IERC20(erc20).balanceOf(address(this));
        require(balanceAfter >= balanceBefore, 'TINOVER');
        return balanceAfter - balanceBefore; // underflow already checked above, just subtract
    }

    /// @dev Similar to EIP20 transfer, except it handles a False success from `transfer` and returns an explanatory
    /// error code rather than reverting. If caller has not called checked protocol's balance, this may revert due to
    /// insufficient cash held in this contract. If caller has checked protocol's balance prior to this call, and verified
    /// it is >= amount, this should not revert in normal conditions.
    /// @notice This wrapper safely handles non-standard ERC-20 tokens that do not return a value.
    /// See here: https://medium.com/coinmonks/missing-return-value-bug-at-least-130-tokens-affected-d67bf08521ca
    function _pushUnderlying(
        address erc20,
        address to,
        uint256 amount
    ) internal {
        EIP20NonStandardInterface(erc20).transfer(to, amount);

        bool success;
        assembly {
            switch returndatasize()
                case 0 {
                    // This is a non-standard ERC-20
                    success := not(0) // set success to true
                }
                case 32 {
                    // This is a complaint ERC-20
                    returndatacopy(0, 0, 32)
                    success := mload(0) // Set `success = returndata` of external call
                }
                default {
                    // This is an excessively non-compliant ERC-20, revert.
                    revert(0, 0)
                }
        }
        require(success, 'TOUTFAIL');
    }
}
