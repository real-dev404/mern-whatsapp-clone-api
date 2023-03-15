const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const Strings = require("../config/strings");
const helpers = require("../helpers/helpers");
const UserService = require("../services/usersServices");
const OtpService = require("../services/otpServices");
const User = require("../models/userModel");
const Otp = require("../models/otpModel");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const otpPhoneNumber = process.env.OTP_PHONE_NUMBER;
const client = require("twilio")(accountSid, authToken);

const registerUser = asyncHandler(async (req, res) => {
  const { name, username, phoneNumber, password, otpCode } = req?.body;
  const userExist = await UserService.findOneUser(phoneNumber);
  if (userExist) {
    res?.status(400);
    throw new Error(Strings.userExists);
  }

  const otp = await OtpService.findLatestOtp(phoneNumber);

  if (otp.code !== otpCode) {
    console.log(otp.code);
    res?.status(400);
    throw new Error("OTP code is wrong");
  } else {
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);
    const user = await User.create({
      name,
      username,
      phoneNumber,
      password: hashPassword,
    });
    if (user) {
      const data = {
        _id: user.id,
        name: user.name,
        username: user.username,
      };
      await OtpService.deleteOtpRecords(phoneNumber);
      res?.status(201).json([data, Strings.userCreatedSuccess]);
    }
  }
});

const checkUser = asyncHandler(async (req, res) => {
  const { name, username, phoneNumber, password } = req?.body;
  const userExist = await UserService.findOneUser(phoneNumber);
  if (userExist) {
    res?.status(400);
    throw new Error(Strings.userExists);
  } else {
    try {
      const instance = new User({ name, username, phoneNumber, password });
      await instance.validate();
      sendOtp(phoneNumber);
      res?.status(201).json(Strings.userCreatedSuccess);
    } catch (error) {
      res?.status(400).json(error);
    }
  }
});
const sendOtp = async (phoneNumber) => {
  let randomN = Math.floor(Math.random() * 90000) + 10000;

  const saveOtp = async (phoneNumber, otpCode) => {
    console.log(otpCode);
    const newOtp = new Otp({
      phoneNumber: phoneNumber,
      code: otpCode,
    });
    try {
      const otp = await newOtp.save();
      return otp;
    } catch (error) {
      console.log("error");
    }
  };

  try {
    await client.messages.create({
      body: `Enter this Otp ${randomN}`,
      from: otpPhoneNumber,
      to: phoneNumber,
    });

    const obj = await saveOtp(phoneNumber, randomN);
    console.log(obj);
  } catch (error) {
    console.log("error generating otp");
  }
};

const loginUser = asyncHandler(async (req, res) => {
  const { phoneNumber, password } = req?.body;
  const user = await UserService.findOneUser(phoneNumber);
  console.log(user);
  if (user && (await bcrypt.compare(password, user.password))) {
    const data = {
      _id: user.id,
      name: user.name,
      username: user.username,
      phoneNumber: user.phoneNumber,
      token: helpers.generateToken(user._id),
    };
    res?.status(200).json([data, Strings.userLoggedInSuccess]);
  } else {
    res?.status(400);
    throw new Error("Invalid credentials");
  }
});

const searchUser = asyncHandler(async (req, res) => {
  const usersList = req.query.name
    ? await UserService.searchUser(req?.query, req.user.name)
    : await UserService.findAllUsers();
  res?.status(200).json([usersList, Strings.userFetchSuccessfully]);
});

const Users = {
  loginUser,
  registerUser,
  searchUser,
  checkUser,
};
module.exports = Users;
