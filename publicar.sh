#!/bin/bash
# Publica o Nossas Viagens no GitHub Pages.
# Uso:  bash publicar.sh "mensagem do commit"
set -e
cd "$(dirname "$0")"
MSG="${1:-atualiza o app}"

if [ ! -d .git ]; then
  git init -b main
  echo "Repositório criado. Depois do primeiro commit, rode:"
  echo "  git remote add origin git@github.com:SEU-USUARIO/nossas-viagens.git"
  echo "  git push -u origin main"
fi

VERSAO=$(grep -o "const VERSAO = '[^']*'" sw.js | cut -d"'" -f2)
echo "Versão atual do service worker: $VERSAO"
echo "Se você mudou o app, troque essa versão em sw.js ANTES de publicar,"
echo "senão quem já instalou continua com a versão antiga."
read -p "Seguir com o commit? [s/N] " ok
[ "$ok" = "s" ] || [ "$ok" = "S" ] || exit 1

git add -A
git commit -m "$MSG"
git push 2>/dev/null || echo "Sem remoto configurado ainda — adicione o origin e rode: git push -u origin main"
