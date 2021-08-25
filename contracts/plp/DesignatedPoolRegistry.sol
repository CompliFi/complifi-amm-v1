pragma solidity 0.7.6;

import '@openzeppelin/contracts/access/Ownable.sol';

import "./IDesignatedPoolRegistry.sol";
import "../libs/complifi/IDerivativeSpecification.sol";
import "../IPool.sol";

contract DesignatedPoolRegistry is IDesignatedPoolRegistry, Ownable {

    event LOG_SET_DESIGNATED_POOL(
        address indexed caller,
        address indexed specification,
        address indexed designatedPool
    );

    mapping(address => address) private _designatedPools;

    function setDesignatedPool(
        address specification,
        address designatedPool
    ) external onlyOwner {
        require(IDerivativeSpecification(specification).isDerivativeSpecification(), 'specification');
        require(IPool(designatedPool).controller() != address(0), 'designated pool');
        emit LOG_SET_DESIGNATED_POOL(msg.sender, specification, designatedPool);
        _designatedPools[specification] = designatedPool;
    }

    function getDesignatedPool(address specification) external view override returns (address) {
        return _designatedPools[specification];
    }
}
