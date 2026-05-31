# 📱 Guia: Ícone de Notificação Android

## ✅ O que foi feito

Atualizei o `app.json` para usar o ícone monochrome (`android-icon-monochrome.png`) para notificações push no Android.

## 🔄 Próximos passos

**IMPORTANTE:** Você precisa fazer um **novo build** para que a mudança tenha efeito:

```bash
npx eas build --platform android --profile preview
```

Ou para produção:
```bash
npx eas build --platform android --profile production
```

## 📋 Requisitos do Ícone de Notificação

O ícone de notificação no Android deve seguir estas especificações:

### ✅ Características obrigatórias:
- **Cor:** Branco puro (#FFFFFF) ou tons de cinza claro
- **Fundo:** Totalmente transparente
- **Formato:** PNG
- **Tamanho recomendado:** 96x96 pixels (ou múltiplos: 48x48, 72x72, 96x96, 144x144, 192x192)
- **Design:** Apenas silhueta/contorno do logo (sem cores, sem gradientes)

### ❌ O que NÃO funciona:
- Ícones coloridos
- Ícones com fundo sólido
- Ícones com gradientes
- Ícones muito detalhados (o Android renderiza em escala de cinza)

## 🎨 Como criar um ícone adequado

### Opção 1: Usar o ícone monochrome existente
O arquivo `android-icon-monochrome.png` já está configurado. Se ele for branco/transparente, deve funcionar.

### Opção 2: Criar um novo ícone específico

1. **Abra o logo da Crea Glass** em um editor de imagens (Photoshop, GIMP, Figma, etc.)

2. **Converta para branco:**
   - Remova todas as cores
   - Converta para escala de cinza
   - Ajuste o brilho para branco puro (#FFFFFF)

3. **Remova o fundo:**
   - Torne o fundo totalmente transparente
   - Certifique-se de que apenas o logo fique visível

4. **Redimensione:**
   - Crie versões em múltiplos tamanhos: 48x48, 72x72, 96x96, 144x144, 192x192
   - Ou use apenas 96x96 (o Expo/EAS pode redimensionar automaticamente)

5. **Salve como PNG:**
   - Nome sugerido: `notification-icon.png`
   - Salve em: `assets/images/notification-icon.png`

6. **Atualize o app.json:**
   ```json
   [
     "expo-notifications",
     {
       "icon": "./assets/images/notification-icon.png",
       "color": "#E6F4FE",
       ...
     }
   ]
   ```

## 🔍 Verificar se o ícone está correto

Para verificar se o ícone está adequado:

1. Abra o arquivo PNG em um visualizador de imagens
2. Verifique se:
   - O fundo é transparente (não branco)
   - O logo é branco/cinza claro
   - Não há cores

## 🐛 Problemas comuns

### Ícone ainda aparece como Expo
- **Causa:** Build antiga ainda instalada
- **Solução:** Faça um novo build e reinstale o app

### Ícone aparece muito escuro
- **Causa:** O ícone não está totalmente branco
- **Solução:** Ajuste o brilho/contraste para branco puro

### Ícone não aparece
- **Causa:** Arquivo não encontrado ou formato incorreto
- **Solução:** Verifique o caminho no `app.json` e se o arquivo existe

## 📝 Nota sobre a cor (`color`)

O parâmetro `"color": "#E6F4FE"` define a cor de fundo do ícone na notificação. Esta cor aparece ao redor do ícone branco. Você pode ajustar para qualquer cor hexadecimal que combine com a identidade visual da Crea Glass.

## 🔗 Referências

- [Expo Notifications - Android Icon](https://docs.expo.dev/versions/latest/sdk/notifications/#android)
- [Android Notification Icon Guidelines](https://material.io/design/iconography/product-icons.html)
