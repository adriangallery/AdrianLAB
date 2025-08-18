#!/usr/bin/env python3
"""
Script para implementar OGPUNK 101003 CAESAR
- Extender rangos OGPUNKS de 100001-101002 a 100001-101003
- Añadir lógica hardcoded para trait 101003
"""

import re
import os

def update_ogpunks_ranges():
    """Extender rangos OGPUNKS en todos los archivos relevantes"""
    
    files_to_update = [
        'pages/api/metadata/floppy/[id].js',
        'pages/api/render/[tokenId].js',
        'pages/api/render/custom/[tokenId].js',
        'pages/api/render/floppy/[tokenId].js',
        'lib/renderers/floppy-renderer.js'
    ]
    
    for file_path in files_to_update:
        if not os.path.exists(file_path):
            print(f"⚠️  Archivo no encontrado: {file_path}")
            continue
            
        print(f"📝 Actualizando rangos en: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Patrones a reemplazar
        patterns = [
            # Rango principal: 100001-101000
            (r'numTokenId >= 100001 && numTokenId <= 101000', 'numTokenId >= 100001 && numTokenId <= 101003'),
            (r'tokenIdNum >= 100001 && tokenIdNum <= 101000', 'tokenIdNum >= 100001 && tokenIdNum <= 101003'),
            (r'numericId >= 100001 && numericId <= 101000', 'numericId >= 100001 && numericId <= 101003'),
            (r'traitId >= 100001 && traitId <= 101000', 'traitId >= 100001 && traitId <= 101003'),
            (r'parseInt\(traitId\) >= 100001 && parseInt\(traitId\) <= 101000', 'parseInt(traitId) >= 100001 && parseInt(traitId) <= 101003'),
            
            # Rango extendido: 101001-101002 → 101001-101003
            (r'101001 && tokenIdNum <= 101002', '101001 && tokenIdNum <= 101003'),
            (r'101001 && numTokenId <= 101002', '101001 && numTokenId <= 101003'),
            (r'101001 && numericId <= 101002', '101001 && numericId <= 101003'),
            (r'101001 && traitId <= 101002', '101001 && traitId <= 101003'),
            (r'101001 && parseInt\(traitId\) <= 101002', '101001 && parseInt(traitId) <= 101003'),
            
            # Comentarios y mensajes
            (r'100001-101000 \(OGPUNKS TOP\)', '100001-101003 (OGPUNKS TOP)'),
            (r'100001-101000', '100001-101003'),
            (r'100001-101002', '100001-101003')
        ]
        
        # Aplicar reemplazos
        original_content = content
        for pattern, replacement in patterns:
            content = re.sub(pattern, replacement, content)
        
        # Verificar si hubo cambios
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ Rangos actualizados en: {file_path}")
        else:
            print(f"ℹ️  No se encontraron rangos para actualizar en: {file_path}")

def add_caesar_logic():
    """Añadir lógica hardcoded para CAESAR en metadata endpoint"""
    
    file_path = 'pages/api/metadata/[tokenId].js'
    if not os.path.exists(file_path):
        print(f"⚠️  Archivo no encontrado: {file_path}")
        return
    
    print(f"🎯 Añadiendo lógica CAESAR en: {file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Buscar la línea donde termina la lógica AdrianPunk
    adrianpunk_end = re.search(r'console\.log\(`\[metadata\] Aviso: no se pudo evaluar override de AdrianPunk:\', e\.message\);\s*\}\s*', content)
    
    if not adrianpunk_end:
        print("⚠️  No se encontró el final de la lógica AdrianPunk")
        return
    
    # Lógica CAESAR a insertar
    caesar_logic = '''
      // LÓGICA ESPECIAL: Si el TOP trait activo es 101003 CAESAR → usar imagen GIF animada
      try {
        if (Array.isArray(categories) && Array.isArray(traitIds)) {
          const topIndex = categories.findIndex(c => c === 'TOP');
          if (topIndex !== -1) {
            const topTraitIdNum = parseInt(traitIds[topIndex].toString());
            if (topTraitIdNum === 101003) {
              baseMetadata.image = `https://adrianlab.vercel.app/labimages/ogpunks/101003.gif?v=${Date.now()}`;
              baseMetadata.external_url = `https://adrianlab.vercel.app/labimages/ogpunks/101003.gif?v=${Date.now()}`;
              console.log(`[metadata] Override de imagen por TOP CAESAR (101003) → GIF animado`);
            }
          }
        }
      } catch (e) {
        console.log('[metadata] Aviso: no se pudo evaluar override de CAESAR:', e.message);
      }'''
    
    # Insertar después de la lógica AdrianPunk
    insert_position = adrianpunk_end.end()
    content = content[:insert_position] + caesar_logic + content[insert_position:]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✅ Lógica CAESAR añadida en: {file_path}")

def add_caesar_render_logic():
    """Añadir lógica hardcoded para CAESAR en render endpoints"""
    
    render_files = [
        'pages/api/render/[tokenId].js',
        'pages/api/render/custom/[tokenId].js'
    ]
    
    for file_path in render_files:
        if not os.path.exists(file_path):
            print(f"⚠️  Archivo no encontrado: {file_path}")
            continue
        
        print(f"🎨 Añadiendo lógica render CAESAR en: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Buscar donde se determina el TOP final
        top_final_pattern = re.search(r'const finalTopTrait = finalTraits\.TOP;', content)
        
        if not top_final_pattern:
            print(f"⚠️  No se encontró 'finalTopTrait' en {file_path}")
            continue
        
        # Lógica CAESAR para render
        caesar_render_logic = '''
        // LÓGICA ESPECIAL: Si el TOP final es 101003 CAESAR → responder con GIF
        if (finalTopTrait === 101003) {
          try {
            const gifResponse = await fetch('https://adrianlab.vercel.app/labimages/ogpunks/101003.gif');
            if (gifResponse.ok) {
              const gifBuffer = await gifResponse.arrayBuffer();
              res.setHeader('Content-Type', 'image/gif');
              res.setHeader('Cache-Control', 'public, max-age=3600');
              res.send(Buffer.from(gifBuffer));
              return;
            }
          } catch (e) {
            console.log(`[render] Fallback a SVG para CAESAR:`, e.message);
          }
        }'''
        
        # Insertar después de la determinación del TOP final
        insert_position = top_final_pattern.end()
        content = content[:insert_position] + caesar_render_logic + content[insert_position:]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"✅ Lógica render CAESAR añadida en: {file_path}")

def main():
    print("🚀 Implementando OGPUNK 101003 CAESAR...")
    print("=" * 50)
    
    # 1. Extender rangos OGPUNKS
    print("\n1️⃣ Extendiendo rangos OGPUNKS...")
    update_ogpunks_ranges()
    
    # 2. Añadir lógica CAESAR en metadata
    print("\n2️⃣ Añadiendo lógica CAESAR en metadata...")
    add_caesar_logic()
    
    # 3. Añadir lógica CAESAR en render
    print("\n3️⃣ Añadiendo lógica CAESAR en render...")
    add_caesar_render_logic()
    
    print("\n" + "=" * 50)
    print("✅ Implementación de CAESAR completada!")
    print("\n📋 Resumen de cambios:")
    print("   • Rangos OGPUNKS extendidos a 100001-101003")
    print("   • Lógica hardcoded añadida en metadata endpoint")
    print("   • Lógica hardcoded añadida en render endpoints")
    print("\n🔍 Verificar cambios antes de commit")

if __name__ == "__main__":
    main()
