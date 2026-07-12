(function(){
var module={exports:{}};
var exports=module.exports;
module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// identity function for calling harmony imports with the correct context
/******/ 	__webpack_require__.i = function(value) { return value; };
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 2);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = createPDF417;

var _bcmathMin = __webpack_require__(1);

/**
 * PDF417 - 2D Barcode generator (LGPLv3)
 *
 * Ported from PHP - PDF417 class, version 1.0.005, from TCPDF library (http://www.tcpdf.org/)
 */

function createPDF417() {
  return {
    ROWHEIGHT: 4,
    QUIETH: 2,
    QUIETV: 2,

    barcode_array: {},
    start_pattern: "11111111010101000",
    stop_pattern: "111111101000101001",

    /**
    * Array of text Compaction Sub-Modes (values 0xFB - 0xFF are used for submode changers).
    */
    textsubmodes: [[0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f, 0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x20, 0xfd, 0xfe, 0xff], // Alpha
    [0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f, 0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x20, 0xfd, 0xfe, 0xff], // Lower
    [0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x26, 0x0d, 0x09, 0x2c, 0x3a, 0x23, 0x2d, 0x2e, 0x24, 0x2f, 0x2b, 0x25, 0x2a, 0x3d, 0x5e, 0xfb, 0x20, 0xfd, 0xfe, 0xff], // Mixed
    [0x3b, 0x3c, 0x3e, 0x40, 0x5b, 0x5c, 0x5d, 0x5f, 0x60, 0x7e, 0x21, 0x0d, 0x09, 0x2c, 0x3a, 0x0a, 0x2d, 0x2e, 0x24, 0x2f, 0x22, 0x7c, 0x2a, 0x28, 0x29, 0x3f, 0x7b, 0x7d, 0x27, 0xff] // Puntuaction
    ],

    /**
    * Array of switching codes for Text Compaction Sub-Modes.
    */
    textlatch: {
      "01": [27],
      "02": [28],
      "03": [28, 25], //
      "10": [28, 28],
      "12": [28],
      "13": [28, 25], //
      "20": [28],
      "21": [27],
      "23": [25], //
      "30": [29],
      "31": [29, 27],
      "32": [29, 28] //
    },

    /**
    * Clusters of codewords (0, 3, 6)<br/>
    * Values are hex equivalents of binary representation of bars (1 = bar, 0 = space).<br/>
    * The codewords numbered from 900 to 928 have special meaning, some enable to switch between modes in order to optimise the code:
    * <ul>
    * <li>900 : Switch to "Text" mode</li>
    * <li>901 : Switch to "Byte" mode</li>
    * <li>902 : Switch to "Numeric" mode</li>
    * <li>903 - 912 : Reserved</li>
    * <li>913 : Switch to "Octet" only for the next codeword</li>
    * <li>914 - 920 : Reserved</li>
    * <li>921 : Initialization</li>
    * <li>922 : Terminator codeword for Macro PDF control block</li>
    * <li>923 : Sequence tag to identify the beginning of optional fields in the Macro PDF control block</li>
    * <li>924 : Switch to "Byte" mode (If the total number of byte is multiple of 6)</li>
    * <li>925 : Identifier for a user defined Extended Channel Interpretation (ECI)</li>
    * <li>926 : Identifier for a general purpose ECI format</li>
    * <li>927 : Identifier for an ECI of a character set or code page</li>
    * <li>928 : Macro marker codeword to indicate the beginning of a Macro PDF Control Block</li>
    * </ul>
    */
    clusters: [[
    // cluster 0 -----------------------------------------------------------------------
    0x1d5c0, 0x1eaf0, 0x1f57c, 0x1d4e0, 0x1ea78, 0x1f53e, 0x1a8c0, 0x1d470, 0x1a860, 0x15040, //  10
    0x1a830, 0x15020, 0x1adc0, 0x1d6f0, 0x1eb7c, 0x1ace0, 0x1d678, 0x1eb3e, 0x158c0, 0x1ac70, //  20
    0x15860, 0x15dc0, 0x1aef0, 0x1d77c, 0x15ce0, 0x1ae78, 0x1d73e, 0x15c70, 0x1ae3c, 0x15ef0, //  30
    0x1af7c, 0x15e78, 0x1af3e, 0x15f7c, 0x1f5fa, 0x1d2e0, 0x1e978, 0x1f4be, 0x1a4c0, 0x1d270, //  40
    0x1e93c, 0x1a460, 0x1d238, 0x14840, 0x1a430, 0x1d21c, 0x14820, 0x1a418, 0x14810, 0x1a6e0, //  50
    0x1d378, 0x1e9be, 0x14cc0, 0x1a670, 0x1d33c, 0x14c60, 0x1a638, 0x1d31e, 0x14c30, 0x1a61c, //  60
    0x14ee0, 0x1a778, 0x1d3be, 0x14e70, 0x1a73c, 0x14e38, 0x1a71e, 0x14f78, 0x1a7be, 0x14f3c, //  70
    0x14f1e, 0x1a2c0, 0x1d170, 0x1e8bc, 0x1a260, 0x1d138, 0x1e89e, 0x14440, 0x1a230, 0x1d11c, //  80
    0x14420, 0x1a218, 0x14410, 0x14408, 0x146c0, 0x1a370, 0x1d1bc, 0x14660, 0x1a338, 0x1d19e, //  90
    0x14630, 0x1a31c, 0x14618, 0x1460c, 0x14770, 0x1a3bc, 0x14738, 0x1a39e, 0x1471c, 0x147bc, // 100
    0x1a160, 0x1d0b8, 0x1e85e, 0x14240, 0x1a130, 0x1d09c, 0x14220, 0x1a118, 0x1d08e, 0x14210, // 110
    0x1a10c, 0x14208, 0x1a106, 0x14360, 0x1a1b8, 0x1d0de, 0x14330, 0x1a19c, 0x14318, 0x1a18e, // 120
    0x1430c, 0x14306, 0x1a1de, 0x1438e, 0x14140, 0x1a0b0, 0x1d05c, 0x14120, 0x1a098, 0x1d04e, // 130
    0x14110, 0x1a08c, 0x14108, 0x1a086, 0x14104, 0x141b0, 0x14198, 0x1418c, 0x140a0, 0x1d02e, // 140
    0x1a04c, 0x1a046, 0x14082, 0x1cae0, 0x1e578, 0x1f2be, 0x194c0, 0x1ca70, 0x1e53c, 0x19460, // 150
    0x1ca38, 0x1e51e, 0x12840, 0x19430, 0x12820, 0x196e0, 0x1cb78, 0x1e5be, 0x12cc0, 0x19670, // 160
    0x1cb3c, 0x12c60, 0x19638, 0x12c30, 0x12c18, 0x12ee0, 0x19778, 0x1cbbe, 0x12e70, 0x1973c, // 170
    0x12e38, 0x12e1c, 0x12f78, 0x197be, 0x12f3c, 0x12fbe, 0x1dac0, 0x1ed70, 0x1f6bc, 0x1da60, // 180
    0x1ed38, 0x1f69e, 0x1b440, 0x1da30, 0x1ed1c, 0x1b420, 0x1da18, 0x1ed0e, 0x1b410, 0x1da0c, // 190
    0x192c0, 0x1c970, 0x1e4bc, 0x1b6c0, 0x19260, 0x1c938, 0x1e49e, 0x1b660, 0x1db38, 0x1ed9e, // 200
    0x16c40, 0x12420, 0x19218, 0x1c90e, 0x16c20, 0x1b618, 0x16c10, 0x126c0, 0x19370, 0x1c9bc, // 210
    0x16ec0, 0x12660, 0x19338, 0x1c99e, 0x16e60, 0x1b738, 0x1db9e, 0x16e30, 0x12618, 0x16e18, // 220
    0x12770, 0x193bc, 0x16f70, 0x12738, 0x1939e, 0x16f38, 0x1b79e, 0x16f1c, 0x127bc, 0x16fbc, // 230
    0x1279e, 0x16f9e, 0x1d960, 0x1ecb8, 0x1f65e, 0x1b240, 0x1d930, 0x1ec9c, 0x1b220, 0x1d918, // 240
    0x1ec8e, 0x1b210, 0x1d90c, 0x1b208, 0x1b204, 0x19160, 0x1c8b8, 0x1e45e, 0x1b360, 0x19130, // 250
    0x1c89c, 0x16640, 0x12220, 0x1d99c, 0x1c88e, 0x16620, 0x12210, 0x1910c, 0x16610, 0x1b30c, // 260
    0x19106, 0x12204, 0x12360, 0x191b8, 0x1c8de, 0x16760, 0x12330, 0x1919c, 0x16730, 0x1b39c, // 270
    0x1918e, 0x16718, 0x1230c, 0x12306, 0x123b8, 0x191de, 0x167b8, 0x1239c, 0x1679c, 0x1238e, // 280
    0x1678e, 0x167de, 0x1b140, 0x1d8b0, 0x1ec5c, 0x1b120, 0x1d898, 0x1ec4e, 0x1b110, 0x1d88c, // 290
    0x1b108, 0x1d886, 0x1b104, 0x1b102, 0x12140, 0x190b0, 0x1c85c, 0x16340, 0x12120, 0x19098, // 300
    0x1c84e, 0x16320, 0x1b198, 0x1d8ce, 0x16310, 0x12108, 0x19086, 0x16308, 0x1b186, 0x16304, // 310
    0x121b0, 0x190dc, 0x163b0, 0x12198, 0x190ce, 0x16398, 0x1b1ce, 0x1638c, 0x12186, 0x16386, // 320
    0x163dc, 0x163ce, 0x1b0a0, 0x1d858, 0x1ec2e, 0x1b090, 0x1d84c, 0x1b088, 0x1d846, 0x1b084, // 330
    0x1b082, 0x120a0, 0x19058, 0x1c82e, 0x161a0, 0x12090, 0x1904c, 0x16190, 0x1b0cc, 0x19046, // 340
    0x16188, 0x12084, 0x16184, 0x12082, 0x120d8, 0x161d8, 0x161cc, 0x161c6, 0x1d82c, 0x1d826, // 350
    0x1b042, 0x1902c, 0x12048, 0x160c8, 0x160c4, 0x160c2, 0x18ac0, 0x1c570, 0x1e2bc, 0x18a60, // 360
    0x1c538, 0x11440, 0x18a30, 0x1c51c, 0x11420, 0x18a18, 0x11410, 0x11408, 0x116c0, 0x18b70, // 370
    0x1c5bc, 0x11660, 0x18b38, 0x1c59e, 0x11630, 0x18b1c, 0x11618, 0x1160c, 0x11770, 0x18bbc, // 380
    0x11738, 0x18b9e, 0x1171c, 0x117bc, 0x1179e, 0x1cd60, 0x1e6b8, 0x1f35e, 0x19a40, 0x1cd30, // 390
    0x1e69c, 0x19a20, 0x1cd18, 0x1e68e, 0x19a10, 0x1cd0c, 0x19a08, 0x1cd06, 0x18960, 0x1c4b8, // 400
    0x1e25e, 0x19b60, 0x18930, 0x1c49c, 0x13640, 0x11220, 0x1cd9c, 0x1c48e, 0x13620, 0x19b18, // 410
    0x1890c, 0x13610, 0x11208, 0x13608, 0x11360, 0x189b8, 0x1c4de, 0x13760, 0x11330, 0x1cdde, // 420
    0x13730, 0x19b9c, 0x1898e, 0x13718, 0x1130c, 0x1370c, 0x113b8, 0x189de, 0x137b8, 0x1139c, // 430
    0x1379c, 0x1138e, 0x113de, 0x137de, 0x1dd40, 0x1eeb0, 0x1f75c, 0x1dd20, 0x1ee98, 0x1f74e, // 440
    0x1dd10, 0x1ee8c, 0x1dd08, 0x1ee86, 0x1dd04, 0x19940, 0x1ccb0, 0x1e65c, 0x1bb40, 0x19920, // 450
    0x1eedc, 0x1e64e, 0x1bb20, 0x1dd98, 0x1eece, 0x1bb10, 0x19908, 0x1cc86, 0x1bb08, 0x1dd86, // 460
    0x19902, 0x11140, 0x188b0, 0x1c45c, 0x13340, 0x11120, 0x18898, 0x1c44e, 0x17740, 0x13320, // 470
    0x19998, 0x1ccce, 0x17720, 0x1bb98, 0x1ddce, 0x18886, 0x17710, 0x13308, 0x19986, 0x17708, // 480
    0x11102, 0x111b0, 0x188dc, 0x133b0, 0x11198, 0x188ce, 0x177b0, 0x13398, 0x199ce, 0x17798, // 490
    0x1bbce, 0x11186, 0x13386, 0x111dc, 0x133dc, 0x111ce, 0x177dc, 0x133ce, 0x1dca0, 0x1ee58, // 500
    0x1f72e, 0x1dc90, 0x1ee4c, 0x1dc88, 0x1ee46, 0x1dc84, 0x1dc82, 0x198a0, 0x1cc58, 0x1e62e, // 510
    0x1b9a0, 0x19890, 0x1ee6e, 0x1b990, 0x1dccc, 0x1cc46, 0x1b988, 0x19884, 0x1b984, 0x19882, // 520
    0x1b982, 0x110a0, 0x18858, 0x1c42e, 0x131a0, 0x11090, 0x1884c, 0x173a0, 0x13190, 0x198cc, // 530
    0x18846, 0x17390, 0x1b9cc, 0x11084, 0x17388, 0x13184, 0x11082, 0x13182, 0x110d8, 0x1886e, // 540
    0x131d8, 0x110cc, 0x173d8, 0x131cc, 0x110c6, 0x173cc, 0x131c6, 0x110ee, 0x173ee, 0x1dc50, // 550
    0x1ee2c, 0x1dc48, 0x1ee26, 0x1dc44, 0x1dc42, 0x19850, 0x1cc2c, 0x1b8d0, 0x19848, 0x1cc26, // 560
    0x1b8c8, 0x1dc66, 0x1b8c4, 0x19842, 0x1b8c2, 0x11050, 0x1882c, 0x130d0, 0x11048, 0x18826, // 570
    0x171d0, 0x130c8, 0x19866, 0x171c8, 0x1b8e6, 0x11042, 0x171c4, 0x130c2, 0x171c2, 0x130ec, // 580
    0x171ec, 0x171e6, 0x1ee16, 0x1dc22, 0x1cc16, 0x19824, 0x19822, 0x11028, 0x13068, 0x170e8, // 590
    0x11022, 0x13062, 0x18560, 0x10a40, 0x18530, 0x10a20, 0x18518, 0x1c28e, 0x10a10, 0x1850c, // 600
    0x10a08, 0x18506, 0x10b60, 0x185b8, 0x1c2de, 0x10b30, 0x1859c, 0x10b18, 0x1858e, 0x10b0c, // 610
    0x10b06, 0x10bb8, 0x185de, 0x10b9c, 0x10b8e, 0x10bde, 0x18d40, 0x1c6b0, 0x1e35c, 0x18d20, // 620
    0x1c698, 0x18d10, 0x1c68c, 0x18d08, 0x1c686, 0x18d04, 0x10940, 0x184b0, 0x1c25c, 0x11b40, // 630
    0x10920, 0x1c6dc, 0x1c24e, 0x11b20, 0x18d98, 0x1c6ce, 0x11b10, 0x10908, 0x18486, 0x11b08, // 640
    0x18d86, 0x10902, 0x109b0, 0x184dc, 0x11bb0, 0x10998, 0x184ce, 0x11b98, 0x18dce, 0x11b8c, // 650
    0x10986, 0x109dc, 0x11bdc, 0x109ce, 0x11bce, 0x1cea0, 0x1e758, 0x1f3ae, 0x1ce90, 0x1e74c, // 660
    0x1ce88, 0x1e746, 0x1ce84, 0x1ce82, 0x18ca0, 0x1c658, 0x19da0, 0x18c90, 0x1c64c, 0x19d90, // 670
    0x1cecc, 0x1c646, 0x19d88, 0x18c84, 0x19d84, 0x18c82, 0x19d82, 0x108a0, 0x18458, 0x119a0, // 680
    0x10890, 0x1c66e, 0x13ba0, 0x11990, 0x18ccc, 0x18446, 0x13b90, 0x19dcc, 0x10884, 0x13b88, // 690
    0x11984, 0x10882, 0x11982, 0x108d8, 0x1846e, 0x119d8, 0x108cc, 0x13bd8, 0x119cc, 0x108c6, // 700
    0x13bcc, 0x119c6, 0x108ee, 0x119ee, 0x13bee, 0x1ef50, 0x1f7ac, 0x1ef48, 0x1f7a6, 0x1ef44, // 710
    0x1ef42, 0x1ce50, 0x1e72c, 0x1ded0, 0x1ef6c, 0x1e726, 0x1dec8, 0x1ef66, 0x1dec4, 0x1ce42, // 720
    0x1dec2, 0x18c50, 0x1c62c, 0x19cd0, 0x18c48, 0x1c626, 0x1bdd0, 0x19cc8, 0x1ce66, 0x1bdc8, // 730
    0x1dee6, 0x18c42, 0x1bdc4, 0x19cc2, 0x1bdc2, 0x10850, 0x1842c, 0x118d0, 0x10848, 0x18426, // 740
    0x139d0, 0x118c8, 0x18c66, 0x17bd0, 0x139c8, 0x19ce6, 0x10842, 0x17bc8, 0x1bde6, 0x118c2, // 750
    0x17bc4, 0x1086c, 0x118ec, 0x10866, 0x139ec, 0x118e6, 0x17bec, 0x139e6, 0x17be6, 0x1ef28, // 760
    0x1f796, 0x1ef24, 0x1ef22, 0x1ce28, 0x1e716, 0x1de68, 0x1ef36, 0x1de64, 0x1ce22, 0x1de62, // 770
    0x18c28, 0x1c616, 0x19c68, 0x18c24, 0x1bce8, 0x19c64, 0x18c22, 0x1bce4, 0x19c62, 0x1bce2, // 780
    0x10828, 0x18416, 0x11868, 0x18c36, 0x138e8, 0x11864, 0x10822, 0x179e8, 0x138e4, 0x11862, // 790
    0x179e4, 0x138e2, 0x179e2, 0x11876, 0x179f6, 0x1ef12, 0x1de34, 0x1de32, 0x19c34, 0x1bc74, // 800
    0x1bc72, 0x11834, 0x13874, 0x178f4, 0x178f2, 0x10540, 0x10520, 0x18298, 0x10510, 0x10508, // 810
    0x10504, 0x105b0, 0x10598, 0x1058c, 0x10586, 0x105dc, 0x105ce, 0x186a0, 0x18690, 0x1c34c, // 820
    0x18688, 0x1c346, 0x18684, 0x18682, 0x104a0, 0x18258, 0x10da0, 0x186d8, 0x1824c, 0x10d90, // 830
    0x186cc, 0x10d88, 0x186c6, 0x10d84, 0x10482, 0x10d82, 0x104d8, 0x1826e, 0x10dd8, 0x186ee, // 840
    0x10dcc, 0x104c6, 0x10dc6, 0x104ee, 0x10dee, 0x1c750, 0x1c748, 0x1c744, 0x1c742, 0x18650, // 850
    0x18ed0, 0x1c76c, 0x1c326, 0x18ec8, 0x1c766, 0x18ec4, 0x18642, 0x18ec2, 0x10450, 0x10cd0, // 860
    0x10448, 0x18226, 0x11dd0, 0x10cc8, 0x10444, 0x11dc8, 0x10cc4, 0x10442, 0x11dc4, 0x10cc2, // 870
    0x1046c, 0x10cec, 0x10466, 0x11dec, 0x10ce6, 0x11de6, 0x1e7a8, 0x1e7a4, 0x1e7a2, 0x1c728, // 880
    0x1cf68, 0x1e7b6, 0x1cf64, 0x1c722, 0x1cf62, 0x18628, 0x1c316, 0x18e68, 0x1c736, 0x19ee8, // 890
    0x18e64, 0x18622, 0x19ee4, 0x18e62, 0x19ee2, 0x10428, 0x18216, 0x10c68, 0x18636, 0x11ce8, // 900
    0x10c64, 0x10422, 0x13de8, 0x11ce4, 0x10c62, 0x13de4, 0x11ce2, 0x10436, 0x10c76, 0x11cf6, // 910
    0x13df6, 0x1f7d4, 0x1f7d2, 0x1e794, 0x1efb4, 0x1e792, 0x1efb2, 0x1c714, 0x1cf34, 0x1c712, // 920
    0x1df74, 0x1cf32, 0x1df72, 0x18614, 0x18e34, 0x18612, 0x19e74, 0x18e32, 0x1bef4], // 929
    [
    // cluster 3 -----------------------------------------------------------------------
    0x1f560, 0x1fab8, 0x1ea40, 0x1f530, 0x1fa9c, 0x1ea20, 0x1f518, 0x1fa8e, 0x1ea10, 0x1f50c, //  10
    0x1ea08, 0x1f506, 0x1ea04, 0x1eb60, 0x1f5b8, 0x1fade, 0x1d640, 0x1eb30, 0x1f59c, 0x1d620, //  20
    0x1eb18, 0x1f58e, 0x1d610, 0x1eb0c, 0x1d608, 0x1eb06, 0x1d604, 0x1d760, 0x1ebb8, 0x1f5de, //  30
    0x1ae40, 0x1d730, 0x1eb9c, 0x1ae20, 0x1d718, 0x1eb8e, 0x1ae10, 0x1d70c, 0x1ae08, 0x1d706, //  40
    0x1ae04, 0x1af60, 0x1d7b8, 0x1ebde, 0x15e40, 0x1af30, 0x1d79c, 0x15e20, 0x1af18, 0x1d78e, //  50
    0x15e10, 0x1af0c, 0x15e08, 0x1af06, 0x15f60, 0x1afb8, 0x1d7de, 0x15f30, 0x1af9c, 0x15f18, //  60
    0x1af8e, 0x15f0c, 0x15fb8, 0x1afde, 0x15f9c, 0x15f8e, 0x1e940, 0x1f4b0, 0x1fa5c, 0x1e920, //  70
    0x1f498, 0x1fa4e, 0x1e910, 0x1f48c, 0x1e908, 0x1f486, 0x1e904, 0x1e902, 0x1d340, 0x1e9b0, //  80
    0x1f4dc, 0x1d320, 0x1e998, 0x1f4ce, 0x1d310, 0x1e98c, 0x1d308, 0x1e986, 0x1d304, 0x1d302, //  90
    0x1a740, 0x1d3b0, 0x1e9dc, 0x1a720, 0x1d398, 0x1e9ce, 0x1a710, 0x1d38c, 0x1a708, 0x1d386, // 100
    0x1a704, 0x1a702, 0x14f40, 0x1a7b0, 0x1d3dc, 0x14f20, 0x1a798, 0x1d3ce, 0x14f10, 0x1a78c, // 110
    0x14f08, 0x1a786, 0x14f04, 0x14fb0, 0x1a7dc, 0x14f98, 0x1a7ce, 0x14f8c, 0x14f86, 0x14fdc, // 120
    0x14fce, 0x1e8a0, 0x1f458, 0x1fa2e, 0x1e890, 0x1f44c, 0x1e888, 0x1f446, 0x1e884, 0x1e882, // 130
    0x1d1a0, 0x1e8d8, 0x1f46e, 0x1d190, 0x1e8cc, 0x1d188, 0x1e8c6, 0x1d184, 0x1d182, 0x1a3a0, // 140
    0x1d1d8, 0x1e8ee, 0x1a390, 0x1d1cc, 0x1a388, 0x1d1c6, 0x1a384, 0x1a382, 0x147a0, 0x1a3d8, // 150
    0x1d1ee, 0x14790, 0x1a3cc, 0x14788, 0x1a3c6, 0x14784, 0x14782, 0x147d8, 0x1a3ee, 0x147cc, // 160
    0x147c6, 0x147ee, 0x1e850, 0x1f42c, 0x1e848, 0x1f426, 0x1e844, 0x1e842, 0x1d0d0, 0x1e86c, // 170
    0x1d0c8, 0x1e866, 0x1d0c4, 0x1d0c2, 0x1a1d0, 0x1d0ec, 0x1a1c8, 0x1d0e6, 0x1a1c4, 0x1a1c2, // 180
    0x143d0, 0x1a1ec, 0x143c8, 0x1a1e6, 0x143c4, 0x143c2, 0x143ec, 0x143e6, 0x1e828, 0x1f416, // 190
    0x1e824, 0x1e822, 0x1d068, 0x1e836, 0x1d064, 0x1d062, 0x1a0e8, 0x1d076, 0x1a0e4, 0x1a0e2, // 200
    0x141e8, 0x1a0f6, 0x141e4, 0x141e2, 0x1e814, 0x1e812, 0x1d034, 0x1d032, 0x1a074, 0x1a072, // 210
    0x1e540, 0x1f2b0, 0x1f95c, 0x1e520, 0x1f298, 0x1f94e, 0x1e510, 0x1f28c, 0x1e508, 0x1f286, // 220
    0x1e504, 0x1e502, 0x1cb40, 0x1e5b0, 0x1f2dc, 0x1cb20, 0x1e598, 0x1f2ce, 0x1cb10, 0x1e58c, // 230
    0x1cb08, 0x1e586, 0x1cb04, 0x1cb02, 0x19740, 0x1cbb0, 0x1e5dc, 0x19720, 0x1cb98, 0x1e5ce, // 240
    0x19710, 0x1cb8c, 0x19708, 0x1cb86, 0x19704, 0x19702, 0x12f40, 0x197b0, 0x1cbdc, 0x12f20, // 250
    0x19798, 0x1cbce, 0x12f10, 0x1978c, 0x12f08, 0x19786, 0x12f04, 0x12fb0, 0x197dc, 0x12f98, // 260
    0x197ce, 0x12f8c, 0x12f86, 0x12fdc, 0x12fce, 0x1f6a0, 0x1fb58, 0x16bf0, 0x1f690, 0x1fb4c, // 270
    0x169f8, 0x1f688, 0x1fb46, 0x168fc, 0x1f684, 0x1f682, 0x1e4a0, 0x1f258, 0x1f92e, 0x1eda0, // 280
    0x1e490, 0x1fb6e, 0x1ed90, 0x1f6cc, 0x1f246, 0x1ed88, 0x1e484, 0x1ed84, 0x1e482, 0x1ed82, // 290
    0x1c9a0, 0x1e4d8, 0x1f26e, 0x1dba0, 0x1c990, 0x1e4cc, 0x1db90, 0x1edcc, 0x1e4c6, 0x1db88, // 300
    0x1c984, 0x1db84, 0x1c982, 0x1db82, 0x193a0, 0x1c9d8, 0x1e4ee, 0x1b7a0, 0x19390, 0x1c9cc, // 310
    0x1b790, 0x1dbcc, 0x1c9c6, 0x1b788, 0x19384, 0x1b784, 0x19382, 0x1b782, 0x127a0, 0x193d8, // 320
    0x1c9ee, 0x16fa0, 0x12790, 0x193cc, 0x16f90, 0x1b7cc, 0x193c6, 0x16f88, 0x12784, 0x16f84, // 330
    0x12782, 0x127d8, 0x193ee, 0x16fd8, 0x127cc, 0x16fcc, 0x127c6, 0x16fc6, 0x127ee, 0x1f650, // 340
    0x1fb2c, 0x165f8, 0x1f648, 0x1fb26, 0x164fc, 0x1f644, 0x1647e, 0x1f642, 0x1e450, 0x1f22c, // 350
    0x1ecd0, 0x1e448, 0x1f226, 0x1ecc8, 0x1f666, 0x1ecc4, 0x1e442, 0x1ecc2, 0x1c8d0, 0x1e46c, // 360
    0x1d9d0, 0x1c8c8, 0x1e466, 0x1d9c8, 0x1ece6, 0x1d9c4, 0x1c8c2, 0x1d9c2, 0x191d0, 0x1c8ec, // 370
    0x1b3d0, 0x191c8, 0x1c8e6, 0x1b3c8, 0x1d9e6, 0x1b3c4, 0x191c2, 0x1b3c2, 0x123d0, 0x191ec, // 380
    0x167d0, 0x123c8, 0x191e6, 0x167c8, 0x1b3e6, 0x167c4, 0x123c2, 0x167c2, 0x123ec, 0x167ec, // 390
    0x123e6, 0x167e6, 0x1f628, 0x1fb16, 0x162fc, 0x1f624, 0x1627e, 0x1f622, 0x1e428, 0x1f216, // 400
    0x1ec68, 0x1f636, 0x1ec64, 0x1e422, 0x1ec62, 0x1c868, 0x1e436, 0x1d8e8, 0x1c864, 0x1d8e4, // 410
    0x1c862, 0x1d8e2, 0x…15070 tokens truncated…_VAL(g[a++]);
      }
    }
    return f;
  },
  cint: function cint(b) {
    if (typeof b == "undefined") {
      b = 0;
    }
    var a = parseInt(b, 10);
    if (isNaN(a)) {
      a = 0;
    }
    return a;
  },
  MIN: function MIN(d, c) {
    return d > c ? c : d;
  },
  MAX: function MAX(d, c) {
    return d > c ? d : c;
  },
  ODD: function ODD(b) {
    return b & 1;
  },
  memset: function memset(d, e, c, a) {
    var b;
    for (b = 0; b < a; b++) {
      d[e + b] = c;
    }
  },
  memcpy: function memcpy(b, f, e, d, a) {
    var c;
    for (c = 0; c < a; c++) {
      b[f + c] = e[d + c];
    }
    return true;
  },
  bc_is_zero: function bc_is_zero(a) {
    var b;
    var c;
    b = a.n_len + a.n_scale;
    c = 0;
    while (b > 0 && a.n_value[c++] === 0) {
      b--;
    }
    if (b !== 0) {
      return false;
    } else {
      return true;
    }
  },
  bc_out_of_memory: function bc_out_of_memory() {
    throw new Error("(BC) Out of memory");
  }
};
libbcmath.bc_add = function (f, d, c) {
  var e, b, a;
  if (f.n_sign === d.n_sign) {
    e = libbcmath._bc_do_add(f, d, c);
    e.n_sign = f.n_sign;
  } else {
    b = libbcmath._bc_do_compare(f, d, false, false);
    switch (b) {
      case -1:
        e = libbcmath._bc_do_sub(d, f, c);
        e.n_sign = d.n_sign;
        break;
      case 0:
        a = libbcmath.MAX(c, libbcmath.MAX(f.n_scale, d.n_scale));
        e = libbcmath.bc_new_num(1, a);
        libbcmath.memset(e.n_value, 0, 0, a + 1);
        break;
      case 1:
        e = libbcmath._bc_do_sub(f, d, c);
        e.n_sign = f.n_sign;
    }
  }
  return e;
};
libbcmath.bc_compare = function (b, a) {
  return libbcmath._bc_do_compare(b, a, true, false);
};
libbcmath._bc_do_compare = function (e, d, c, b) {
  var g, a;
  var f;
  if (c && e.n_sign != d.n_sign) {
    if (e.n_sign == libbcmath.PLUS) {
      return 1;
    } else {
      return -1;
    }
  }
  if (e.n_len != d.n_len) {
    if (e.n_len > d.n_len) {
      if (!c || e.n_sign == libbcmath.PLUS) {
        return 1;
      } else {
        return -1;
      }
    } else {
      if (!c || e.n_sign == libbcmath.PLUS) {
        return -1;
      } else {
        return 1;
      }
    }
  }
  f = e.n_len + Math.min(e.n_scale, d.n_scale);
  g = 0;
  a = 0;
  while (f > 0 && e.n_value[g] == d.n_value[a]) {
    g++;
    a++;
    f--;
  }
  if (b && f == 1 && e.n_scale == d.n_scale) {
    return 0;
  }
  if (f !== 0) {
    if (e.n_value[g] > d.n_value[a]) {
      if (!c || e.n_sign == libbcmath.PLUS) {
        return 1;
      } else {
        return -1;
      }
    } else {
      if (!c || e.n_sign == libbcmath.PLUS) {
        return -1;
      } else {
        return 1;
      }
    }
  }
  if (e.n_scale != d.n_scale) {
    if (e.n_scale > d.n_scale) {
      for (f = e.n_scale - d.n_scale; f > 0; f--) {
        if (e.n_value[g++] !== 0) {
          if (!c || e.n_sign == libbcmath.PLUS) {
            return 1;
          } else {
            return -1;
          }
        }
      }
    } else {
      for (f = d.n_scale - e.n_scale; f > 0; f--) {
        if (d.n_value[a++] !== 0) {
          if (!c || e.n_sign == libbcmath.PLUS) {
            return -1;
          } else {
            return 1;
          }
        }
      }
    }
  }
  return 0;
};
libbcmath._one_mult = function (d, e, i, f, j, c) {
  var h, g;
  var b, a;
  if (f === 0) {
    libbcmath.memset(j, 0, 0, i);
  } else {
    if (f == 1) {
      libbcmath.memcpy(j, c, d, e, i);
    } else {
      b = e + i - 1;
      a = c + i - 1;
      h = 0;
      while (i-- > 0) {
        g = d[b--] * f + h;
        j[a--] = g % libbcmath.BASE;
        h = Math.floor(g / libbcmath.BASE);
      }
      if (h != 0) {
        j[a] = h;
      }
    }
  }
};
libbcmath.bc_divide = function (l, k, z) {
  var y;
  var w;
  var c, b;
  var p, o, h, x;
  var u, A;
  var j, i, s, q, a, g;
  var r, m, t, v;
  var e;
  var n;
  var f;
  var d;
  if (libbcmath.bc_is_zero(k)) {
    return -1;
  }
  if (libbcmath.bc_is_zero(l)) {
    return libbcmath.bc_new_num(1, z);
  }
  if (k.n_scale === 0) {
    if (k.n_len === 1 && k.n_value[0] === 1) {
      w = libbcmath.bc_new_num(l.n_len, z);
      w.n_sign = l.n_sign == k.n_sign ? libbcmath.PLUS : libbcmath.MINUS;
      libbcmath.memset(w.n_value, l.n_len, 0, z);
      libbcmath.memcpy(w.n_value, 0, l.n_value, 0, l.n_len + libbcmath.MIN(l.n_scale, z));
    }
  }
  s = k.n_scale;
  h = k.n_len + s - 1;
  while (s > 0 && k.n_value[h--] === 0) {
    s--;
  }
  j = l.n_len + s;
  u = l.n_scale - s;
  if (u < z) {
    a = z - u;
  } else {
    a = 0;
  }
  c = libbcmath.safe_emalloc(1, l.n_len + l.n_scale, a + 2);
  if (c === null) {
    libbcmath.bc_out_of_memory();
  }
  libbcmath.memset(c, 0, 0, l.n_len + l.n_scale + a + 2);
  libbcmath.memcpy(c, 1, l.n_value, 0, l.n_len + l.n_scale);
  i = k.n_len + s;
  b = libbcmath.safe_emalloc(1, i, 1);
  if (b === null) {
    libbcmath.bc_out_of_memory();
  }
  libbcmath.memcpy(b, 0, k.n_value, 0, i);
  b[i] = 0;
  h = 0;
  while (b[h] === 0) {
    h++;
    i--;
  }
  if (i > j + z) {
    q = z + 1;
    n = true;
  } else {
    n = false;
    if (i > j) {
      q = z + 1;
    } else {
      q = j - i + z + 1;
    }
  }
  w = libbcmath.bc_new_num(q - z, z);
  libbcmath.memset(w.n_value, 0, 0, q);
  e = libbcmath.safe_emalloc(1, i, 1);
  if (e === null) {
    libbcmath.bc_out_of_memory();
  }
  if (!n) {
    f = Math.floor(10 / (k.n_value[h] + 1));
    if (f != 1) {
      libbcmath._one_mult(c, 0, j + u + a + 1, f, c, 0);
      libbcmath._one_mult(k.n_value, h, i, f, k.n_value, h);
    }
    r = 0;
    if (i > j) {
      x = i - j;
    } else {
      x = 0;
    }
    while (r <= j + z - i) {
      if (k.n_value[h] == c[r]) {
        m = 9;
      } else {
        m = Math.floor((c[r] * 10 + c[r + 1]) / k.n_value[h]);
      }
      if (k.n_value[h + 1] * m > (c[r] * 10 + c[r + 1] - k.n_value[h] * m) * 10 + c[r + 2]) {
        m--;
        if (k.n_value[h + 1] * m > (c[r] * 10 + c[r + 1] - k.n_value[h] * m) * 10 + c[r + 2]) {
          m--;
        }
      }
      t = 0;
      if (m !== 0) {
        e[0] = 0;
        libbcmath._one_mult(k.n_value, h, i, m, e, 1);
        p = r + i;
        o = i;
        for (g = 0; g < i + 1; g++) {
          if (o < 0) {
            A = c[p] - 0 - t;
          } else {
            A = c[p] - e[o--] - t;
          }
          if (A < 0) {
            A += 10;
            t = 1;
          } else {
            t = 0;
          }
          c[p--] = A;
        }
      }
      if (t == 1) {
        m--;
        p = r + i;
        o = i - 1;
        v = 0;
        for (g = 0; g < i; g++) {
          if (o < 0) {
            A = c[p] + 0 + v;
          } else {
            A = c[p] + k.n_value[o--] + v;
          }
          if (A > 9) {
            A -= 10;
            v = 1;
          } else {
            v = 0;
          }
          c[p--] = A;
        }
        if (v == 1) {
          c[p] = (c[p] + 1) % 10;
        }
      }
      w.n_value[x++] = m;
      r++;
    }
  }
  w.n_sign = l.n_sign == k.n_sign ? libbcmath.PLUS : libbcmath.MINUS;
  if (libbcmath.bc_is_zero(w)) {
    w.n_sign = libbcmath.PLUS;
  }
  libbcmath._bc_rm_leading_zeros(w);
  return w;
};
libbcmath._bc_do_add = function (h, g, i) {
  var f;
  var c, b;
  var k, e, j;
  var m, l, a;
  var d;
  c = libbcmath.MAX(h.n_scale, g.n_scale);
  b = libbcmath.MAX(h.n_len, g.n_len) + 1;
  f = libbcmath.bc_new_num(b, libbcmath.MAX(c, i));
  l = h.n_scale;
  a = g.n_scale;
  k = h.n_len + l - 1;
  e = g.n_len + a - 1;
  j = c + b - 1;
  if (l != a) {
    if (l > a) {
      while (l > a) {
        f.n_value[j--] = h.n_value[k--];
        l--;
      }
    } else {
      while (a > l) {
        f.n_value[j--] = g.n_value[e--];
        a--;
      }
    }
  }
  l += h.n_len;
  a += g.n_len;
  m = 0;
  while (l > 0 && a > 0) {
    d = h.n_value[k--] + g.n_value[e--] + m;
    if (d >= libbcmath.BASE) {
      m = 1;
      d -= libbcmath.BASE;
    } else {
      m = 0;
    }
    f.n_value[j] = d;
    j--;
    l--;
    a--;
  }
  if (l === 0) {
    while (a-- > 0) {
      d = g.n_value[e--] + m;
      if (d >= libbcmath.BASE) {
        m = 1;
        d -= libbcmath.BASE;
      } else {
        m = 0;
      }
      f.n_value[j--] = d;
    }
  } else {
    while (l-- > 0) {
      d = h.n_value[k--] + m;
      if (d >= libbcmath.BASE) {
        m = 1;
        d -= libbcmath.BASE;
      } else {
        m = 0;
      }
      f.n_value[j--] = d;
    }
  }
  if (m == 1) {
    f.n_value[j] += 1;
  }
  libbcmath._bc_rm_leading_zeros(f);
  return f;
};
libbcmath._bc_do_sub = function (h, g, i) {
  var l;
  var m, a;
  var d, f;
  var k, c, n;
  var j, e, b;
  a = libbcmath.MAX(h.n_len, g.n_len);
  m = libbcmath.MAX(h.n_scale, g.n_scale);
  f = libbcmath.MIN(h.n_len, g.n_len);
  d = libbcmath.MIN(h.n_scale, g.n_scale);
  l = libbcmath.bc_new_num(a, libbcmath.MAX(m, i));
  k = h.n_len + h.n_scale - 1;
  c = g.n_len + g.n_scale - 1;
  n = a + m - 1;
  j = 0;
  if (h.n_scale != d) {
    for (e = h.n_scale - d; e > 0; e--) {
      l.n_value[n--] = h.n_value[k--];
    }
  } else {
    for (e = g.n_scale - d; e > 0; e--) {
      b = 0 - g.n_value[c--] - j;
      if (b < 0) {
        b += libbcmath.BASE;
        j = 1;
      } else {
        j = 0;
        l.n_value[n--] = b;
      }
    }
  }
  for (e = 0; e < f + d; e++) {
    b = h.n_value[k--] - g.n_value[c--] - j;
    if (b < 0) {
      b += libbcmath.BASE;
      j = 1;
    } else {
      j = 0;
    }
    l.n_value[n--] = b;
  }
  if (a != f) {
    for (e = a - f; e > 0; e--) {
      b = h.n_value[k--] - j;
      if (b < 0) {
        b += libbcmath.BASE;
        j = 1;
      } else {
        j = 0;
      }
      l.n_value[n--] = b;
    }
  }
  libbcmath._bc_rm_leading_zeros(l);
  return l;
};
libbcmath.MUL_BASE_DIGITS = 80;
libbcmath.MUL_SMALL_DIGITS = libbcmath.MUL_BASE_DIGITS / 4;
libbcmath.bc_multiply = function (f, d, h) {
  var c;
  var b, a;
  var g, e;
  b = f.n_len + f.n_scale;
  a = d.n_len + d.n_scale;
  g = f.n_scale + d.n_scale;
  e = libbcmath.MIN(g, libbcmath.MAX(h, libbcmath.MAX(f.n_scale, d.n_scale)));
  c = libbcmath._bc_rec_mul(f, b, d, a, g);
  c.n_sign = f.n_sign == d.n_sign ? libbcmath.PLUS : libbcmath.MINUS;
  c.n_len = a + b + 1 - g;
  c.n_scale = e;
  libbcmath._bc_rm_leading_zeros(c);
  if (libbcmath.bc_is_zero(c)) {
    c.n_sign = libbcmath.PLUS;
  }
  return c;
};
libbcmath.new_sub_num = function (b, d, c) {
  var a = new libbcmath.bc_num();
  a.n_sign = libbcmath.PLUS;
  a.n_len = b;
  a.n_scale = d;
  a.n_value = c;
  return a;
};
libbcmath._bc_simp_mul = function (i, b, h, m, a) {
  var j;
  var k, c, f;
  var n, l;
  var e, g, d;
  d = b + m + 1;
  j = libbcmath.bc_new_num(d, 0);
  n = b - 1;
  l = m - 1;
  f = d - 1;
  g = 0;
  for (e = 0; e < d - 1; e++) {
    k = n - libbcmath.MAX(0, e - m + 1);
    c = l - libbcmath.MIN(e, m - 1);
    while (k >= 0 && c <= l) {
      g += i.n_value[k--] * h.n_value[c++];
    }
    j.n_value[f--] = Math.floor(g % libbcmath.BASE);
    g = Math.floor(g / libbcmath.BASE);
  }
  j.n_value[f] = g;
  return j;
};
libbcmath._bc_shift_addsub = function (b, g, a, d) {
  var c, h;
  var e, f;
  e = g.n_len;
  if (g.n_value[0] === 0) {
    e--;
  }
  if (!(b.n_len + b.n_scale >= a + e)) {
    throw new Error("len + scale < shift + count");
  }
  c = b.n_len + b.n_scale - a - 1;
  h = g.n_len = 1;
  f = 0;
  if (d) {
    while (e--) {
      b.n_value[c] -= g.n_value[h--] + f;
      if (b.n_value[c] < 0) {
        f = 1;
        b.n_value[c--] += libbcmath.BASE;
      } else {
        f = 0;
        c--;
      }
    }
    while (f) {
      b.n_value[c] -= f;
      if (b.n_value[c] < 0) {
        b.n_value[c--] += libbcmath.BASE;
      } else {
        f = 0;
      }
    }
  } else {
    while (e--) {
      b.n_value[c] += g.n_value[h--] + f;
      if (b.n_value[c] > libbcmath.BASE - 1) {
        f = 1;
        b.n_value[c--] -= libbcmath.BASE;
      } else {
        f = 0;
        c--;
      }
    }
    while (f) {
      b.n_value[c] += f;
      if (b.n_value[c] > libbcmath.BASE - 1) {
        b.n_value[c--] -= libbcmath.BASE;
      } else {
        f = 0;
      }
    }
  }
  return true;
};
libbcmath._bc_rec_mul = function (m, i, l, j, c) {
  var k;
  var s, r, h, g;
  var f, p;
  var d, b, a, y, x;
  var o, w, e;
  var q, t;
  if (i + j < libbcmath.MUL_BASE_DIGITS || i < libbcmath.MUL_SMALL_DIGITS || j < libbcmath.MUL_SMALL_DIGITS) {
    return libbcmath._bc_simp_mul(m, i, l, j, c);
  }
  o = Math.floor((libbcmath.MAX(i, j) + 1) / 2);
  if (i < o) {
    r = libbcmath.bc_init_num();
    s = libbcmath.new_sub_num(i, 0, m.n_value);
  } else {
    r = libbcmath.new_sub_num(i - o, 0, m.n_value);
    s = libbcmath.new_sub_num(o, 0, m.n_value + i - o);
  }
  if (j < o) {
    g = libbcmath.bc_init_num();
    h = libbcmath.new_sub_num(j, 0, l.n_value);
  } else {
    g = libbcmath.new_sub_num(j - o, 0, l.n_value);
    h = libbcmath.new_sub_num(o, 0, l.n_value + j - o);
  }
  libbcmath._bc_rm_leading_zeros(r);
  libbcmath._bc_rm_leading_zeros(s);
  f = s.n_len;
  libbcmath._bc_rm_leading_zeros(g);
  libbcmath._bc_rm_leading_zeros(h);
  p = h.n_len;
  e = libbcmath.bc_is_zero(r) || libbcmath.bc_is_zero(g);
  y = libbcmath.bc_init_num();
  x = libbcmath.bc_init_num();
  y = libbcmath.bc_sub(r, s, 0);
  q = y.n_len;
  x = libbcmath.bc_sub(h, g, 0);
  t = x.n_len;
  if (e) {
    d = libbcmath.bc_init_num();
  } else {
    d = libbcmath._bc_rec_mul(r, r.n_len, g, g.n_len, 0);
  }
  if (libbcmath.bc_is_zero(y) || libbcmath.bc_is_zero(x)) {
    b = libbcmath.bc_init_num();
  } else {
    b = libbcmath._bc_rec_mul(y, q, x, t, 0);
  }
  if (libbcmath.bc_is_zero(s) || libbcmath.bc_is_zero(h)) {
    a = libbcmath.bc_init_num();
  } else {
    a = libbcmath._bc_rec_mul(s, s.n_len, h, h.n_len, 0);
  }
  w = i + j + 1;
  k = libbcmath.bc_new_num(w, 0);
  if (!e) {
    libbcmath._bc_shift_addsub(k, d, 2 * o, 0);
    libbcmath._bc_shift_addsub(k, d, o, 0);
  }
  libbcmath._bc_shift_addsub(k, a, o, 0);
  libbcmath._bc_shift_addsub(k, a, 0, 0);
  libbcmath._bc_shift_addsub(k, b, o, y.n_sign != x.n_sign);
  return k;
};
libbcmath.bc_sub = function (e, d, c) {
  var f;
  var b, a;
  if (e.n_sign != d.n_sign) {
    f = libbcmath._bc_do_add(e, d, c);
    f.n_sign = e.n_sign;
  } else {
    b = libbcmath._bc_do_compare(e, d, false, false);
    switch (b) {
      case -1:
        f = libbcmath._bc_do_sub(d, e, c);
        f.n_sign = d.n_sign == libbcmath.PLUS ? libbcmath.MINUS : libbcmath.PLUS;
        break;
      case 0:
        a = libbcmath.MAX(c, libbcmath.MAX(e.n_scale, d.n_scale));
        f = libbcmath.bc_new_num(1, a);
        libbcmath.memset(f.n_value, 0, 0, a + 1);
        break;
      case 1:
        f = libbcmath._bc_do_sub(e, d, c);
        f.n_sign = e.n_sign;
        break;
    }
  }
  return f;
};
function bcadd(b, d, f) {
  var e, c, a;
  if (typeof f == "undefined") {
    f = libbcmath.scale;
  }
  f = f < 0 ? 0 : f;
  e = libbcmath.bc_init_num();
  c = libbcmath.bc_init_num();
  a = libbcmath.bc_init_num();
  e = libbcmath.php_str2num(b.toString());
  c = libbcmath.php_str2num(d.toString());
  if (e.n_scale > c.n_scale) {
    c.setScale(e.n_scale);
  }
  if (c.n_scale > e.n_scale) {
    e.setScale(c.n_scale);
  }
  a = libbcmath.bc_add(e, c, f);
  if (a.n_scale > f) {
    a.n_scale = f;
  }
  return a.toString();
}
function bcsub(b, d, f) {
  var e, c, a;
  if (typeof f == "undefined") {
    f = libbcmath.scale;
  }
  f = f < 0 ? 0 : f;
  e = libbcmath.bc_init_num();
  c = libbcmath.bc_init_num();
  a = libbcmath.bc_init_num();
  e = libbcmath.php_str2num(b.toString());
  c = libbcmath.php_str2num(d.toString());
  if (e.n_scale > c.n_scale) {
    c.setScale(e.n_scale);
  }
  if (c.n_scale > e.n_scale) {
    e.setScale(c.n_scale);
  }
  a = libbcmath.bc_sub(e, c, f);
  if (a.n_scale > f) {
    a.n_scale = f;
  }
  return a.toString();
}
function bccomp(a, c, e) {
  var d, b;
  if (typeof e == "undefined") {
    e = libbcmath.scale;
  }
  e = e < 0 ? 0 : e;
  d = libbcmath.bc_init_num();
  b = libbcmath.bc_init_num();
  d = libbcmath.bc_str2num(a.toString(), e);
  b = libbcmath.bc_str2num(c.toString(), e);
  return libbcmath.bc_compare(d, b, e);
}
function bcscale(a) {
  a = parseInt(a, 10);
  if (isNaN(a)) {
    return false;
  }
  if (a < 0) {
    return false;
  }
  libbcmath.scale = a;
  return true;
}
function bcdiv(b, d, f) {
  var e, c, a;
  if (typeof f == "undefined") {
    f = libbcmath.scale;
  }
  f = f < 0 ? 0 : f;
  e = libbcmath.bc_init_num();
  c = libbcmath.bc_init_num();
  a = libbcmath.bc_init_num();
  e = libbcmath.php_str2num(b.toString());
  c = libbcmath.php_str2num(d.toString());
  if (e.n_scale > c.n_scale) {
    c.setScale(e.n_scale);
  }
  if (c.n_scale > e.n_scale) {
    e.setScale(c.n_scale);
  }
  a = libbcmath.bc_divide(e, c, f);
  if (a === -1) {
    throw new Error(11, "(BC) Division by zero");
  }
  if (a.n_scale > f) {
    a.n_scale = f;
  }
  return a.toString();
}
function bcmul(b, d, f) {
  var e, c, a;
  if (typeof f == "undefined") {
    f = libbcmath.scale;
  }
  f = f < 0 ? 0 : f;
  e = libbcmath.bc_init_num();
  c = libbcmath.bc_init_num();
  a = libbcmath.bc_init_num();
  e = libbcmath.php_str2num(b.toString());
  c = libbcmath.php_str2num(d.toString());
  if (e.n_scale > c.n_scale) {
    c.setScale(e.n_scale);
  }
  if (c.n_scale > e.n_scale) {
    e.setScale(c.n_scale);
  }
  a = libbcmath.bc_multiply(e, c, f);
  if (a.n_scale > f) {
    a.n_scale = f;
  }
  return a.toString();
}
function bcround(d, b) {
  var a, c;
  a = "0." + Array(b + 1).join("0") + "5";
  if (d.toString().substring(0, 1) == "-") {
    a = "-" + a;
  }
  c = bcadd(d, a, b);
  return c;
}

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = generateBarcode;

var _pdf417Min = __webpack_require__(0);

var _pdf417Min2 = _interopRequireDefault(_pdf417Min);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function drawBarcode(canvas, barcodeMatrix, blockWidth, blockHeight) {
  var ctx = canvas.getContext('2d');
  var positionY = 0;
  for (var row = 0; row < barcodeMatrix.num_rows; row += 1) {
    var positionX = 0;
    for (var col = 0; col < barcodeMatrix.num_cols; col += 1) {
      if (barcodeMatrix.bcode[row][col] === '1') {
        ctx.fillStyle = '#000';
      } else {
        ctx.fillStyle = '#FFF';
      }
      ctx.fillRect(positionX, positionY, blockWidth, blockHeight);
      positionX += blockWidth;
    }
    positionY += blockHeight;
  }
}

function generateBarcode(text, blockWidth, blockHeight) {
  var canvas = document.createElement('canvas');
  var PDF417 = (0, _pdf417Min2.default)();
  PDF417.init(text);
  var barcodeMatrix = PDF417.getBarcodeArray();
  canvas.width = blockWidth * barcodeMatrix.num_cols;
  canvas.height = blockHeight * barcodeMatrix.num_rows;
  drawBarcode(canvas, barcodeMatrix, blockWidth, blockHeight);
  return canvas.toDataURL();
}

/***/ })
/******/ ]);
window.__pdf417gen=module.exports&&module.exports.default?module.exports.default:module.exports;
})();
