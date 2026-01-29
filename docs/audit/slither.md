**THIS CHECKLIST IS NOT COMPLETE**. Use `--show-ignored-findings` to show all the results.
Summary
 - [unused-return](#unused-return) (2 results) (Medium)
 - [assembly](#assembly) (2 results) (Informational)
 - [naming-convention](#naming-convention) (8 results) (Informational)
## unused-return
Impact: Medium
Confidence: Medium
 - [ ] ID-0
[ConfidentialOFT._buildMsgAndOptions(SendParam,uint256)](src/ConfidentialOFT.sol#L96-L110) ignores return value by [IOAppMsgInspector(msgInspector).inspect(msgPayload,options)](src/ConfidentialOFT.sol#L109)

src/ConfidentialOFT.sol#L96-L110


 - [ ] ID-1
[ConfidentialOFT._buildMsgAndOptions(CSendParams,bytes)](src/ConfidentialOFT.sol#L112-L122) ignores return value by [IOAppMsgInspector(msgInspector).inspect(typedMessage,options)](src/ConfidentialOFT.sol#L121)

src/ConfidentialOFT.sol#L112-L122


## assembly
Impact: Informational
Confidence: High
 - [ ] ID-2
[ConfidentialTransfers._getCStorage()](src/ConfidentialTransfers.sol#L53-L57) uses assembly
	- [INLINE ASM](src/ConfidentialTransfers.sol#L54-L56)

src/ConfidentialTransfers.sol#L53-L57


 - [ ] ID-3
[ConfidentialTransfersBridgeable._getBridgeableStorage()](src/ConfidentialTransfersBridgeable.sol#L30-L34) uses assembly
	- [INLINE ASM](src/ConfidentialTransfersBridgeable.sol#L31-L33)

src/ConfidentialTransfersBridgeable.sol#L30-L34


## naming-convention
Impact: Informational
Confidence: High
 - [ ] ID-4
Parameter [ConfidentialTransfers.__ConfidentialTransfers_init(uint256,PlonkVerifier,PlonkVerifier,PlonkVerifier,PlonkVerifier,PlonkVerifier)._applyAndTransferVerifier](src/ConfidentialTransfers.sol#L65) is not in mixedCase

src/ConfidentialTransfers.sol#L65


 - [ ] ID-5
Parameter [ConfidentialTransfers.__ConfidentialTransfers_init(uint256,PlonkVerifier,PlonkVerifier,PlonkVerifier,PlonkVerifier,PlonkVerifier)._transferVerifier](src/ConfidentialTransfers.sol#L64) is not in mixedCase

src/ConfidentialTransfers.sol#L64


 - [ ] ID-6
Parameter [ConfidentialTransfers.__ConfidentialTransfers_init(uint256,PlonkVerifier,PlonkVerifier,PlonkVerifier,PlonkVerifier,PlonkVerifier)._maxPendingTransfers](src/ConfidentialTransfers.sol#L60) is not in mixedCase

src/ConfidentialTransfers.sol#L60


 - [ ] ID-7
Parameter [ConfidentialTransfers.__ConfidentialTransfers_init(uint256,PlonkVerifier,PlonkVerifier,PlonkVerifier,PlonkVerifier,PlonkVerifier)._applyVerifier](src/ConfidentialTransfers.sol#L62) is not in mixedCase

src/ConfidentialTransfers.sol#L62


 - [ ] ID-8
Function [ConfidentialTransfers.__ConfidentialTransfers_init(uint256,PlonkVerifier,PlonkVerifier,PlonkVerifier,PlonkVerifier,PlonkVerifier)](src/ConfidentialTransfers.sol#L59-L74) is not in mixedCase

src/ConfidentialTransfers.sol#L59-L74


 - [ ] ID-9
Parameter [ConfidentialTransfers.__ConfidentialTransfers_init(uint256,PlonkVerifier,PlonkVerifier,PlonkVerifier,PlonkVerifier,PlonkVerifier)._initVerifier](src/ConfidentialTransfers.sol#L61) is not in mixedCase

src/ConfidentialTransfers.sol#L61


 - [ ] ID-10
Parameter [ConfidentialTransfers.__ConfidentialTransfers_init(uint256,PlonkVerifier,PlonkVerifier,PlonkVerifier,PlonkVerifier,PlonkVerifier)._updateVerifier](src/ConfidentialTransfers.sol#L63) is not in mixedCase

src/ConfidentialTransfers.sol#L63


 - [ ] ID-11
Function [ConfidentialTransfersBridgeable.__ConfidentialTransfersBridgeable_init(PlonkVerifier)](src/ConfidentialTransfersBridgeable.sol#L36-L38) is not in mixedCase

src/ConfidentialTransfersBridgeable.sol#L36-L38


