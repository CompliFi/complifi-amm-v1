pragma solidity 0.7.6;

import '../libs/complifi/tokens/TokenMetadataGenerator.sol';
import '../libs/complifi/tokens/EIP20NonStandardInterface.sol';

import '../IPool.sol';
import '../Token.sol';
import '../Math.sol';
import '../libs/complifi/IVault.sol';
import "./IRolloverStrategy.sol";
import "./IDesignatedPoolRegistry.sol";

contract PermanentLiquidityPool is Token, Math, TokenMetadataGenerator {

    event LOG_DELEGATE(address indexed caller, address indexed recipient, address indexed poolToken, uint256 tokenAmountIn, uint256 tokenAmountOut);

    event LOG_UNDELEGATE(address indexed caller, address indexed recipient, address indexed poolToken, uint256 tokenAmountIn, uint256 tokenAmountOut);

    event LOG_ROLLOVER(address indexed caller, address indexed designatedPool, address indexed newDesignatedPool);

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

    function requireLock() internal view {
        require(!_mutex, 'REENTRY');
    }

    bool private _mutex;

    IDerivativeSpecification public derivativeSpecification;
    IRolloverStrategy public rolloverStrategy;
    IDesignatedPoolRegistry public designatedPoolRegistry;

    IPool public designatedPool;

    constructor(
        address _derivativeSpecification,
        address _designatedPoolRegistry,
        address _rolloverStrategy,
        address _designatedPool
    ) public {
        require(_derivativeSpecification != address(0), 'NOT_SPEC');
        derivativeSpecification = IDerivativeSpecification(_derivativeSpecification);

        require(_designatedPoolRegistry != address(0), 'NOT_DESIGNATED_REGISTRY');
        designatedPoolRegistry = IDesignatedPoolRegistry(_designatedPoolRegistry);

        require(_rolloverStrategy != address(0), 'NOT_ROLLOVER_STRATEGY');
        rolloverStrategy = IRolloverStrategy(_rolloverStrategy);

        require(_designatedPool != address(0), 'NOT_DESIGNATED_POOL');
        designatedPool = IPool(_designatedPool);

        setName(
            makeTokenName(derivativeSpecification.name(), 'PLP', '')
        );
        setSymbol(
            makeTokenSymbol(
                derivativeSpecification.symbol(),
                'PLP',
                ''
            )
        );
    }

    function rollOver(
        uint256[] calldata _underlyingEndRoundHints
    )
    external
    _logs_
    _lock_
    {
        if(block.timestamp < designatedPool.derivativeVault().settleTime()) { return; }

        IPool newDesignatedPool = IPool(designatedPoolRegistry.getDesignatedPool(
            address(derivativeSpecification)
        ));
        if(address(newDesignatedPool) == address(0)) { return; }
        if(address(designatedPool) == address(newDesignatedPool)) { return; }

        require(block.timestamp < newDesignatedPool.derivativeVault().settleTime(), "NEW_SETTLED");
        require(newDesignatedPool.swappable() == false, "NEW_SWAPPABLE");

        uint256 designatedPoolAmount = designatedPool.balanceOf(address(this));
        designatedPool.approve(address(rolloverStrategy), designatedPoolAmount);
        rolloverStrategy.execute(
            address(designatedPool),
            designatedPoolAmount,
            _underlyingEndRoundHints,
           address(newDesignatedPool)
        );

        emit LOG_ROLLOVER(msg.sender, address(designatedPool), address(newDesignatedPool));
        designatedPool = newDesignatedPool;

        newDesignatedPool.setSwappable();
    }

    function performDelegate(address recipient, uint256 tokenAmount)
        internal
        _lock_
    {
        require(block.timestamp < designatedPool.derivativeVault().settleTime(), 'SETTLED');
        require(recipient != address(0), 'ZERO_RECIPIENT');
        require(tokenAmount > 0, 'ZERO_AMOUNT');
        require(designatedPool.balanceOf(msg.sender) >= tokenAmount, 'INSUFFICIENT_AMOUNT');

        uint256 tokenAmountOut = tokenAmount;

        uint256 poolTotal = totalSupply();
        uint256 designatedPoolBalance = designatedPool.balanceOf(address(this));
        if(poolTotal > 0 && designatedPoolBalance > 0) {
            uint256 ratio = div(poolTotal, designatedPoolBalance);
            require(ratio != 0, 'APPROX');

            tokenAmountOut = mul(ratio, tokenAmount);
        }

        _pullToken(address(designatedPool), msg.sender, tokenAmount);

        emit LOG_DELEGATE(msg.sender, recipient, address(designatedPool), tokenAmount, tokenAmountOut);
        _mintPoolShare(tokenAmountOut);
        _pushPoolShare(recipient, tokenAmountOut);
    }

    function delegate(uint256 tokenAmount)
        external
        _logs_
    {
        performDelegate(msg.sender, tokenAmount);
    }

    function delegateTo(address recipient, uint256 tokenAmount)
        external
        _logs_
    {
        performDelegate(recipient, tokenAmount);
    }

    function performUnDelegate(address recipient, uint256 tokenAmount)
        internal
        _lock_
    {
        require(recipient != address(0), 'ZERO_RECIPIENT');
        require(tokenAmount > 0, 'ZERO_AMOUNT');
        require(this.balanceOf(msg.sender) >= tokenAmount, 'INSUFFICIENT_AMOUNT');

        uint256 poolTotal = totalSupply();
        uint256 designatedPoolBalance = designatedPool.balanceOf(address(this));
        uint256 ratio = div(designatedPoolBalance, poolTotal);
        require(ratio != 0, 'APPROX');

        uint256 tokenAmountOut = mul(ratio, tokenAmount);

        _pullPoolShare(msg.sender, tokenAmount);
        _burnPoolShare(tokenAmount);

        emit LOG_UNDELEGATE(msg.sender, recipient, address(designatedPool), tokenAmount, tokenAmountOut);
        _pushToken(address(designatedPool), recipient, tokenAmountOut);
    }

    function unDelegate(uint256 tokenAmount)
        external
        _logs_
    {
        performUnDelegate(msg.sender, tokenAmount);
    }

    function unDelegateTo(address recipient, uint256 tokenAmount)
        external
        _logs_
    {
        performUnDelegate(recipient, tokenAmount);
    }

    // ==
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

    function _pullToken(
        address erc20,
        address from,
        uint256 amount
    ) internal {
        bool xfer = IERC20(erc20).transferFrom(from, address(this), amount);
        require(xfer, "ERR_ERC20_FALSE");
    }

    function _pushToken(
        address erc20,
        address to,
        uint256 amount
    ) internal {
        bool xfer = IERC20(erc20).transfer(to, amount);
        require(xfer, "ERR_ERC20_FALSE");
    }
}
