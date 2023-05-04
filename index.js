const mongoose = require("mongoose");
const express = require("express");
const joi = require("joi");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

mongoose.connect(process.env.MONGO);

const User = require("./models/user");
const Paciente = require("./models/paciente");
const Registro = require("./models/registro");
const Psicologo = require("./models/psicologo");

const app = express();

const port = process.env.PORT || 3000;

app.use(express.json());

// joi validator para body das requests
const validator = (joiSchema) => (req, res, next) => {
    console.log(req.body);
    const { error } = joiSchema.validate(req.body);
    if (error) return res.status(406).send({ message: error });
    else next();
};

const duplicatedEmail = async (req, res, next) => {
    const { email } = req.body;
    const candidate = await User.findOne({ email: email });
    if (candidate) {
        return res.status(409).send({ message: "Email ja cadastrado" });
    }
    return next();
};

const validateJWT = (req, res, next) => {
    const token = req.headers["x-access-token"];
    if (!token) {
        return res.status(401).send({ message: "Usuario nao logado" });
    }

    const decoded = jwt.verify(token, process.env.SECRET);
    if (!decoded) {
        return res.status(401).send({ message: "Usuario nao logado" });
    }

    req.body.userId = decoded.userId;
    return next();
};

app.post(
    "/login",
    validator(
        joi.object({
            email: joi.string().required().max(50),
            password: joi.string().required().max(50),
        })
    ),
    async (req, res) => {
        const body = req.body;

        const candidate = await User.findOne({ email: body.email });
        if (!candidate)
            return res.status(401).send({ message: "Email nao cadastrado" });

        if (await bcrypt.compare(body.password, candidate.password)) {
            const token = jwt.sign(
                { userId: candidate._id },
                process.env.SECRET,
                {
                    expiresIn: 30000,
                }
            );
            return res.status(200).send({ token, type: candidate.__t });
        } else {
            res.status(401).send({ message: "Credenciais invalidas" });
        }
    }
);

app.post(
    "/pac_register",
    validator(
        joi.object({
            name: joi.string().required().max(100),
            email: joi.string().required().max(100),
            password: joi.string().required().max(20),
            cpf: joi.string().required().length(11),
        })
    ),
    duplicatedEmail,
    async (req, res) => {
        const body = req.body;

        const hash = await bcrypt.hash(body.password, 10);

        const newUser = new Paciente({
            name: body.name,
            email: body.email,
            password: hash,
            cpf: body.cpf,
        });

        await newUser.save();

        res.status(400).send({ message: "Usuario criado com sucesso" });
    }
);

app.post(
    "/psic_register",
    validator(
        joi.object({
            name: joi.string().required().max(100),
            email: joi.string().required().max(100),
            password: joi.string().required().max(20),
            cpf: joi.string().required().length(11),
            crp: joi.string().required(),
        })
    ),
    duplicatedEmail,
    async (req, res) => {
        const body = req.body;
        const sameEmail = await User.findOne({ email: body.email });

        if (sameEmail) {
            res.status(409).send({ message: "Email ja cadastrado" });
            return;
        }

        const hash = await bcrypt.hash(body.password, 10);

        const newUser = new Psicologo({
            name: body.name,
            email: body.email,
            password: hash,
            cpf: body.cpf,
            crp: body.crp,
        });

        await newUser.save();

        res.status(400).send({ message: "Usuario criado com sucesso" });
    }
);

app.get("/users", async (req, res) => {
    const users = await User.find({});

    res.status(200).send({ users });
});

app.get("/registros", validateJWT, async (req, res) => {
    const { userId } = req.body;
    const id = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(id);

    if (user.__t == "Psicologo") {
        return res.status(500).send({ message: "not implemented" });
    }

    const registers = await Registro.find({ pacienteId: user._id });

    return res.status(200).send({ registers });
});

app.post(
    "/registro",
    validator(
        joi.object({
            data: joi.date().required(),
            titulo: joi.string().required().max(50),
            text: joi.string().required(),
        })
    ),
    validateJWT,
    async (req, res) => {
        const { data, titulo, text, userId } = req.body;

        const newRegistro = new Registro({
            data,
            titulo,
            text,
            pacienteId: userId,
        });

        await newRegistro.save();

        return res.status(200).send({ registro: newRegistro });
    }
);

app.listen(port, () => {
    console.log(`Server running at ${port}`);
});
