pragma solidity 0.7.6;

import "../Token.sol";
import "../IPool.sol";
import "./IRolloverStrategy.sol";
import "../Math.sol";
import '../libs/complifi/tokens/IERC20Metadata.sol';
import '../repricers/IRepricer.sol';
import '../IDynamicFee.sol';

contract RolloverStrategy is IRolloverStrategy, Num {

    // Using vars to avoid stack do deep error
    struct Vars {
        IERC20 collateralToken;
        IERC20 primaryToken;
        IERC20 complementToken;
        IVault vault;
        IPool pool;
        uint256 primaryTokenBalance;
        uint256 complementTokenBalance;
        uint256 primaryTokenAmount;
        uint256 complementTokenAmount;
    }

    function execute(
        address _poolSettled,
        uint256 _poolAmountIn,
        uint256[] memory _underlyingEndRoundHints,
        address _poolNew
    ) external override {
        Vars memory vars;

        vars.pool = IPool(_poolSettled);
        vars.vault = IVault(vars.pool.derivativeVault());
        require(vars.vault.settleTime() <= block.timestamp, "SETTLED");

        IVault vaultNew = IVault(IPool(_poolNew).derivativeVault());
        require(vars.vault.derivativeSpecification() == vaultNew.derivativeSpecification(), "SPECS");
        require(vaultNew.settleTime() > block.timestamp, "NOT_SETTLED");

        vars.collateralToken = IERC20(vars.vault.collateralToken());

        removeLiquidityOnSettledStateInternal(
            _poolSettled,
            _poolAmountIn,
            [uint256(0), uint256(0)], // minAmountsOut,
            _underlyingEndRoundHints,
            address(this)
        );

        mintAndJoinPoolInternal(
            _poolNew,
            vars.collateralToken.balanceOf(address(this)),
            0, // minPoolAmountOut
            false
        );
    }

    /// @notice Remove settled derivatives from AMM pool redeem for collateral
    /// @dev User provides amount of LP tokens (method applies only when state = Settled)
    function removeLiquidityOnSettledStateInternal(
        address _pool,
        uint256 _poolAmountIn,
        uint256[2] memory _minAmountsOut,
        uint256[] memory _underlyingEndRoundHints,
        address recipient
    ) internal {

        Vars memory vars;
        vars.pool = IPool(_pool);

        vars.vault = IVault(vars.pool.derivativeVault());

        vars.primaryToken = IERC20(vars.vault.primaryToken());
        vars.complementToken = IERC20(vars.vault.complementToken());
        vars.collateralToken = IERC20(vars.vault.collateralToken());

        require(
            vars.pool.transferFrom(msg.sender, address(this), _poolAmountIn),
            "TAKE_POOL"
        );

        // Approve LP tokens for POOL
        require(vars.pool.approve(_pool, _poolAmountIn), "APPROVE");

        // Step 1: Users sends LP tokens, receives (ΔBprim-, ΔBcompl-, ΔC-)
        vars.pool.exitPool(_poolAmountIn, _minAmountsOut);

        vars.primaryTokenAmount = vars.primaryToken.balanceOf(address(this));
        vars.complementTokenAmount = vars.complementToken.balanceOf(address(this));

        vars.primaryToken.approve(address(vars.vault), vars.primaryTokenAmount);
        vars.complementToken.approve(address(vars.vault), vars.complementTokenAmount);

        vars.vault.redeemTo(
            recipient,
            vars.primaryTokenAmount,
            vars.complementTokenAmount,
            _underlyingEndRoundHints
        );
    }

    function mintAndJoinPoolInternal(
        address _pool,
        uint256 _collateralAmount,
        uint256 _minPoolAmountOut,
        bool _shouldTransferCollateral
    ) internal {
        Vars memory vars;
        vars.pool = IPool(_pool);

        vars.vault = IVault(vars.pool.derivativeVault());

        vars.primaryToken = IERC20(vars.vault.primaryToken());
        vars.complementToken = IERC20(vars.vault.complementToken());
        vars.collateralToken = IERC20(vars.vault.collateralToken());

        if(_shouldTransferCollateral) {
            // Transfer collateral tokens from users to Proxy
            require(
                vars.collateralToken.transferFrom(msg.sender, address(this), _collateralAmount),
                "TAKE_COLLATERAL"
            );
        }

        // Approve collateral Tokens for Vault Contract
        vars.collateralToken.approve(address(vars.vault), _collateralAmount);

        // Mint derivatives
        vars.vault.mintTo(address(this), _collateralAmount);

        uint lpTokenSupply = IERC20(address(vars.pool)).totalSupply();
        vars.primaryTokenBalance = vars.pool.getBalance(address(vars.primaryToken));
        vars.complementTokenBalance = vars.pool.getBalance(address(vars.complementToken));
        vars.primaryTokenAmount = vars.primaryToken.balanceOf(address(this));
        vars.complementTokenAmount = vars.complementToken.balanceOf(address(this));

        uint lpTokenMultiplier = 1;
        uint tokenDecimals = uint(IERC20Metadata(address(vars.collateralToken)).decimals());
        if(tokenDecimals > 0 && tokenDecimals < 18) {
            lpTokenMultiplier = 18 - tokenDecimals;
        }

        uint poolAmountOut = min(
            lpTokenSupply * scaleTo(vars.primaryTokenAmount, lpTokenMultiplier) * BONE / scaleTo(vars.primaryTokenBalance, lpTokenMultiplier),
            lpTokenSupply * scaleTo(vars.complementTokenAmount, lpTokenMultiplier) * BONE / scaleTo(vars.complementTokenBalance, lpTokenMultiplier)
        ) / BONE;

        require(poolAmountOut >= _minPoolAmountOut, "MIN_POOL_AMOUNT_OUT");

        vars.primaryToken.approve(_pool, vars.primaryTokenAmount);
        vars.complementToken.approve(_pool, vars.complementTokenAmount);

        uint256[2] memory tokenBalances;
        tokenBalances[0] = vars.primaryTokenAmount;
        tokenBalances[1] = vars.complementTokenAmount;

        vars.pool.joinPool(poolAmountOut, tokenBalances);

        require(vars.pool.transfer(msg.sender, poolAmountOut), "GIVE_POOL");
    }

    function scaleTo(uint256 _amount, uint256 _decimal) internal returns (uint256) {
        return _amount * (10 ** _decimal);
    }
}
