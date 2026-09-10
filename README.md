# Dr. Claudete Grassi — pacote completo

Este pacote contém o código-fonte, build, imagens locais, informações fornecidas, schema/seed do MySQL e scripts de inicialização do site.

## Execução recomendada

Requisitos: Node.js 22 ou superior, pnpm e acesso ao MySQL Railway.

1. Entre na pasta `app`.
2. Copie `config/mysql.env.example` para `app/.env` e preencha as variáveis do MySQL.
3. Execute `./run.sh` no Linux/macOS ou `run.bat` no Windows.
4. Abra `http://localhost:3000/`. A página inicial é servida pelo índice do aplicativo.

O comando de inicialização instala dependências, compila o frontend e inicia o servidor Express. Isso evita a tela branca que ocorre quando os arquivos React são abertos diretamente como `file://` sem o servidor e sem o fallback de rotas.

## Acesso administrativo

O painel está em `/painel` e utiliza autenticação local independente do Manus:

- Usuário: `Admin`
- Senha: `Admin123@`

## MySQL externo

O site usa exclusivamente as variáveis `MYSQL_*` para o banco de agendamentos. O arquivo `database/schema.sql` cria as tabelas e `database/seed.sql` contém os serviços e horários iniciais. O arquivo de configuração de exemplo não contém a senha real por segurança.

Para hospedagem, o host e a porta precisam ser acessíveis pelo servidor da aplicação. `localhost` só funciona quando o MySQL está no mesmo computador/servidor que executa o site.

## Estrutura

- `app/`: código-fonte completo do projeto e build do servidor.
- `build/`: build compilado do frontend e servidor.
- `assets/images/`: imagens locais utilizadas na landing page.
- `database/`: schema e dados iniciais do MySQL externo.
- `documents/`: TXT original e fontes públicas utilizadas.
- `index.html`: entrada do frontend compilado para hospedagem estática; para o agendamento e painel, use o servidor com `run.sh`/`run.bat`.

## Observação sobre rotas

O servidor deve ser usado em produção porque `/agendar`, `/acompanhar`, `/agendamento/:token` e `/painel` são rotas da aplicação React e dependem das APIs do servidor. O Express já fornece o fallback do `index.html`, evitando erro de página branca ao atualizar essas URLs.
