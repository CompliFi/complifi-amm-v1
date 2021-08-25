pragma solidity 0.7.6;

interface IDesignatedPoolRegistry {
    function getDesignatedPool(address derivativeSpecification) external view returns (address);
}
