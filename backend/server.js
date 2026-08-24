const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, "../frontend")));

const DB_FILE = path.join(__dirname, "db.json");

// ===============================
// BANCO DE DADOS
// ===============================

function criarDBInicial() {
  return {
    usuarios: [],
    pacientes: [],
    triagens: [],
    consultas: [],
    tv_chamada: null,
    tv_historico: []
  };
}

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const db = criarDBInicial();
    writeDB(db);
    return db;
  }

  try {
    const conteudo = fs.readFileSync(DB_FILE, "utf8");

    if (!conteudo.trim()) {
      const db = criarDBInicial();
      writeDB(db);
      return db;
    }

    const db = JSON.parse(conteudo);

    // Garante que todas as propriedades existam
    if (!db.usuarios) db.usuarios = [];
    if (!db.pacientes) db.pacientes = [];
    if (!db.triagens) db.triagens = [];
    if (!db.consultas) db.consultas = [];
    if (!db.tv_chamada) db.tv_chamada = null;
    if (!db.tv_historico) db.tv_historico = [];

    return db;

  } catch (erro) {
    console.error("Erro ao ler db.json:", erro);

    throw new Error("Banco de dados inválido ou corrompido.");
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  } catch (erro) {
    console.error("Erro ao salvar db.json:", erro);
    throw new Error("Não foi possível salvar o banco de dados.");
  }
}

// ===============================
// LOGIN
// ===============================

app.post("/login", (req, res) => {
  try {
    const db = readDB();

    const { usuario, senha } = req.body;

    if (!usuario || !senha) {
      return res.status(400).json({
        erro: "Usuário e senha são obrigatórios."
      });
    }

    const user = db.usuarios.find(
      u =>
        u.usuario === usuario &&
        u.senha === senha
    );

    if (!user) {
      return res.status(401).json({
        erro: "Login inválido"
      });
    }

    res.json(user);

  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Erro interno no servidor."
    });
  }
});

// ===============================
// ATENDIMENTO - CADASTRAR PACIENTE
// ===============================

app.post("/atendimento", (req, res) => {
  try {
    const db = readDB();

    const { nome, cpf, tipo } = req.body;

    if (!nome) {
      return res.status(400).json({
        erro: "Nome do paciente é obrigatório."
      });
    }

    const paciente = {
      id: Date.now(),
      nome,
      cpf: cpf || "",
      tipo: tipo || "normal",
      status: "triagem",
      createdAt: new Date()
    };

    db.pacientes.push(paciente);

    writeDB(db);

    res.status(201).json(paciente);

  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Erro ao cadastrar paciente."
    });
  }
});

// ===============================
// LISTAR PACIENTES
// ===============================

app.get("/pacientes", (req, res) => {
  try {
    const db = readDB();

    res.json(db.pacientes);

  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Erro ao buscar pacientes."
    });
  }
});

// ===============================
// BUSCAR PACIENTE POR ID
// ===============================

app.get("/pacientes/:id", (req, res) => {
  try {
    const db = readDB();

    const id = Number(req.params.id);

    const paciente = db.pacientes.find(
      p => p.id === id
    );

    if (!paciente) {
      return res.status(404).json({
        erro: "Paciente não encontrado."
      });
    }

    res.json(paciente);

  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Erro ao buscar paciente."
    });
  }
});

// ===============================
// TRIAGEM
// ===============================

app.post("/triagem", (req, res) => {
  try {
    const db = readDB();

    const {
      pacienteId,
      nome,
      sintoma,
      temperatura,
      alergia,
      observacao,
      risco: riscoEnviado
    } = req.body;

    // Converte temperatura para número
    const temperaturaNumerica =
      temperatura !== undefined &&
      temperatura !== null &&
      temperatura !== ""
        ? Number(temperatura)
        : null;

    if (
      temperatura !== undefined &&
      temperatura !== null &&
      temperatura !== "" &&
      Number.isNaN(temperaturaNumerica)
    ) {
      return res.status(400).json({
        erro: "Temperatura inválida."
      });
    }

    // ===============================
    // ENCONTRA O PACIENTE
    // ===============================

    let paciente = null;

    if (pacienteId) {
      paciente = db.pacientes.find(
        p => p.id === Number(pacienteId)
      );

      if (!paciente) {
        return res.status(404).json({
          erro: "Paciente não encontrado."
        });
      }
    }

    // ===============================
    // DEFINIÇÃO DO RISCO
    // ===============================

    let risco = riscoEnviado;

    if (
      temperaturaNumerica !== null &&
      temperaturaNumerica >= 39
    ) {
      risco = "vermelho";

    } else if (
      temperaturaNumerica !== null &&
      temperaturaNumerica >= 38
    ) {
      risco = "amarelo";

    } else if (!risco) {
      risco = "verde";
    }

    // ===============================
    // CRIA TRIAGEM
    // ===============================

    const triagem = {
      id: Date.now(),
      pacienteId: paciente
        ? paciente.id
        : null,

      nome: paciente
        ? paciente.nome
        : nome,

      sintoma: sintoma || "",
      temperatura: temperaturaNumerica,
      alergia: alergia || "",
      observacao: observacao || "",
      risco,

      status: "aguardando_medico",

      createdAt: new Date()
    };

    db.triagens.push(triagem);

    // ===============================
    // ATUALIZA STATUS DO PACIENTE
    // ===============================

    if (paciente) {
      paciente.status = "aguardando_medico";
    }

    writeDB(db);

    res.status(201).json(triagem);

  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Erro ao realizar triagem."
    });
  }
});

// ===============================
// LISTAR TRIAGENS
// ===============================

app.get("/triagens", (req, res) => {
  try {
    const db = readDB();

    res.json(db.triagens);

  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Erro ao buscar triagens."
    });
  }
});

// ===============================
// BUSCAR TRIAGEM POR ID
// ===============================

app.get("/triagens/:id", (req, res) => {
  try {
    const db = readDB();

    const id = Number(req.params.id);

    const triagem = db.triagens.find(
      t => t.id === id
    );

    if (!triagem) {
      return res.status(404).json({
        erro: "Triagem não encontrada."
      });
    }

    res.json(triagem);

  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Erro ao buscar triagem."
    });
  }
});

// ==================================================
// MÍDIA INDOOR - TV
// ==================================================

// ===============================
// CHAMAR PACIENTE NA TV
// ===============================

app.post("/tv/chamar", (req, res) => {
  try {
    const db = readDB();

    const {
      localTipo,
      localNumero,
      paciente
    } = req.body;

    if (!paciente) {
      return res.status(400).json({
        erro: "Paciente é obrigatório."
      });
    }

    const chamada = {
      id: Date.now().toString(),

      localTipo:
        localTipo || "guiche",

      localNumero:
        localNumero || "1",

      paciente,

      hora: new Date().toLocaleTimeString(
        "pt-BR",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      )
    };

    // Chamada atual
    db.tv_chamada = chamada;

    // Adiciona ao histórico
    db.tv_historico.unshift(chamada);

    // Mantém somente as 5 últimas chamadas
    if (db.tv_historico.length > 5) {
      db.tv_historico.pop();
    }

    writeDB(db);

    res.json(chamada);

  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Erro ao chamar paciente na TV."
    });
  }
});

// ===============================
// CONSULTAR CHAMADA DA TV
// ===============================

app.get("/tv/chamada", (req, res) => {
  try {
    const db = readDB();

    res.json({
      chamada: db.tv_chamada,
      historico: db.tv_historico
    });

  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Erro ao buscar chamada da TV."
    });
  }
});

// ===============================
// LIMPAR CHAMADA ATUAL DA TV
// ===============================

app.delete("/tv/chamada", (req, res) => {
  try {
    const db = readDB();

    db.tv_chamada = null;

    writeDB(db);

    res.json({
      sucesso: true,
      mensagem: "Chamada removida da TV."
    });

  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Erro ao limpar chamada da TV."
    });
  }
});

// ===============================
// LISTA DE MEDICAÇÕES
// ===============================

app.get("/lista-medicacoes", (req, res) => {
  res.json([
    "Dipirona",
    "Paracetamol",
    "Ibuprofeno",
    "Amoxicilina",
    "Azitromicina",
    "Loratadina",
    "Omeprazol",
    "Buscopan",
    "Dramin",
    "Soro fisiológico"
  ]);
});

// ===============================
// CONSULTA MÉDICA
// ===============================

app.post("/consulta", (req, res) => {
  try {
    const db = readDB();

    const {
      paciente,
      diagnostico,
      medicacao,
      obs
    } = req.body;

    if (!paciente) {
      return res.status(400).json({
        erro: "Paciente é obrigatório."
      });
    }

    const consulta = {
      id: Date.now(),

      paciente,

      diagnostico:
        diagnostico || "",

      medicacao:
        medicacao || "",

      obs:
        obs || "",

      createdAt: new Date()
    };

    db.consultas.push(consulta);

    // ===============================
    // ATUALIZA STATUS DO PACIENTE
    // ===============================

    const pacienteEncontrado = db.pacientes.find(
      p =>
        p.id === Number(paciente.id) ||
        p.nome === paciente.nome
    );

    if (pacienteEncontrado) {
      pacienteEncontrado.status = "atendido";
    }

    writeDB(db);

    res.status(201).json(consulta);

  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Erro ao registrar consulta."
    });
  }
});

// ===============================
// LISTAR CONSULTAS
// ===============================

app.get("/medicacoes", (req, res) => {
  try {
    const db = readDB();

    res.json(db.consultas);

  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Erro ao buscar consultas."
    });
  }
});

// ===============================
// LISTAR CONSULTAS
// ALIAS MAIS CLARO
// ===============================

app.get("/consultas", (req, res) => {
  try {
    const db = readDB();

    res.json(db.consultas);

  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Erro ao buscar consultas."
    });
  }
});

// ===============================
// ROTA INICIAL
// ===============================

app.get("/api/status", (req, res) => {
  res.json({
    servidor: "online",
    mensagem: "Sistema funcionando corretamente."
  });
});

// ===============================
// TRATAMENTO DE ROTA NÃO ENCONTRADA
// ===============================

app.use((req, res) => {
  res.status(404).json({
    erro: "Rota não encontrada."
  });
});

// ===============================
// TRATAMENTO DE ERROS
// ===============================

app.use((err, req, res, next) => {
  console.error("Erro interno:", err);

  res.status(500).json({
    erro: "Erro interno do servidor."
  });
});

// ===============================
// START
// ===============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
});
