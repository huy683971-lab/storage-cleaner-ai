
import "./style.css";
import blockhash from "blockhash-core";

document.querySelector("#app").innerHTML = `
  <div class="container">
    <h1>Storage Cleaner AI</h1>

    <input
      id="imageInput"
      type="file"
      multiple
      accept="image/*"
    >

    <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
      <button id="scanBtn">Quét ảnh</button>

      <button id="selectAllBtn">
        Chọn tất cả
      </button>

      <button id="exportBtn">
        Xuất danh sách
      </button>
    </div>
<div id="summary"></div>
    <div id="result"></div>
  </div>
`;


const imageInput = document.getElementById("imageInput");
const scanBtn = document.getElementById("scanBtn");
const selectAllBtn = document.getElementById("selectAllBtn");
const exportBtn = document.getElementById("exportBtn");
const result = document.getElementById("result");

// Thêm dòng này
const summary = document.getElementById("summary");
function updateSummary() {
  const checked = document.querySelectorAll(
    ".delete-checkbox:checked"
  );

  let totalSize = 0;

  checked.forEach((cb) => {
    totalSize += Number(cb.dataset.size || 0);
  });

  summary.innerHTML = `
    <p>Ảnh sẽ xóa: ${checked.length}</p>
    <p>Dung lượng giải phóng:
      ${(totalSize / 1024 / 1024).toFixed(2)} MB
    </p>
  `;
}

scanBtn.addEventListener("click", scanImages);

selectAllBtn.addEventListener("click", toggleSelectAll);
exportBtn.addEventListener("click", exportSelected);

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function hammingDistance(a, b) {
  if (!a || !b || a.length !== b.length) {
    return Infinity;
  }

  let distance = 0;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      distance++;
    }
  }

  return distance;
}

function getImageHash(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );

        const hash = blockhash.bmvbhash(
          imageData.data,
          canvas.width,
          canvas.height,
          16
        );

        URL.revokeObjectURL(img.src);

        resolve(hash);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = reject;

    img.src = URL.createObjectURL(file);
  });
}

async function scanImages() {
  summary.innerHTML = "";
  console.clear();

  const files = [...imageInput.files];

  if (files.length === 0) {
    alert("Vui lòng chọn ảnh.");
    return;
  }

  scanBtn.disabled = true;

  try {
    result.innerHTML = `
      <p>Đang quét ${files.length} ảnh...</p>
    `;

    const imageData = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      result.innerHTML = `
        <p>Đang xử lý ${i + 1}/${files.length}</p>
        <p>${file.name}</p>
      `;

      try {
        const hash = await getImageHash(file);

        console.log("HASH:", file.name, hash);

        imageData.push({
          file,
          hash
        });
      } catch (error) {
        console.error(file.name, error);
      }
    }

    const duplicateGroups = [];
    const used = new Set();

    const MAX_DISTANCE = 10;

    for (let i = 0; i < imageData.length; i++) {
      if (used.has(i)) continue;

      const group = [imageData[i]];

      for (let j = i + 1; j < imageData.length; j++) {
        if (used.has(j)) continue;

        const distance = hammingDistance(
          imageData[i].hash,
          imageData[j].hash
        );

        if (distance <= MAX_DISTANCE) {
          group.push(imageData[j]);
          used.add(j);
        }
      }

      if (group.length > 1) {
        group.sort(
          (a, b) => b.file.size - a.file.size
        );

        duplicateGroups.push(group);
      }
    }

    duplicateGroups.sort((a, b) => {
      const sizeA = a.reduce(
        (sum, item) => sum + item.file.size,
        0
      );

      const sizeB = b.reduce(
        (sum, item) => sum + item.file.size,
        0
      );

      return sizeB - sizeA;
    });

    let duplicateCount = 0;
    let duplicateSize = 0;

    let html = `
      <h2>Kết quả</h2>

      <p>
        <strong>Tổng ảnh:</strong>
        ${files.length}
      </p>
    `;

    if (duplicateGroups.length === 0) {
      html += `
        <p>Không phát hiện ảnh trùng.</p>
      `;
    } else {
      duplicateGroups.forEach((group, groupIndex) => {
        html += `
          <h3>Nhóm ${groupIndex + 1}</h3>
          <ul style="padding:0;">
        `;

        group.forEach((item, itemIndex) => {
          const imageUrl = URL.createObjectURL(
            item.file
          );

          html += `
            <li
              style="
                list-style:none;
                margin-bottom:12px;
              "
            >
              <label
                style="
                  display:flex;
                  gap:12px;
                  align-items:center;
                "
              >
<input
  type="checkbox"
  class="delete-checkbox"
  data-size="${item.file.size}"
  ${itemIndex === 0 ? "disabled" : "checked"}
>

                <img
                  src="${imageUrl}"
                  width="80"
                  height="80"
                  style="
                    width:80px;
                    height:80px;
                    object-fit:cover;
                    border-radius:8px;
                    cursor:pointer;
                    flex-shrink:0;
                  "
                  onclick="window.open('${imageUrl}','_blank')"
                >

                <div style="flex:1;">
                  <div>
                    ${item.file.name}
                  </div>

                  <div>
                    ${formatBytes(item.file.size)}
                  </div>

                  <div>
                    ${
                      itemIndex === 0
                        ? "⭐ Giữ lại"
                        : "🗑️ Đề xuất xóa"
                    }
                  </div>
                </div>
              </label>
            </li>
          `;

          if (itemIndex > 0) {
            duplicateCount++;
            duplicateSize += item.file.size;
          }
        });

        html += `</ul>`;
      });
    }

    html += `
      <hr>

      <p>
        <strong>Ảnh trùng:</strong>
        ${duplicateCount}
      </p>

      <p>
        <strong>Có thể giải phóng:</strong>
        ${formatBytes(duplicateSize)}
      </p>
    `;

    result.innerHTML = html;
updateSummary();
  } catch (error) {
    console.error(error);

    result.innerHTML = `
      <p style="color:red;">
        ${error.message}
      </p>
    `;
  } finally {
    scanBtn.disabled = false;
  }
}

function exportSelected() {
  const selected = [];

  document
    .querySelectorAll(
      '#result input[type="checkbox"]:checked:not(:disabled)'
    )
    .forEach((checkbox) => {
      const info = checkbox
        .closest("label")
        .querySelector("div");

      selected.push(info.innerText);
    });

  if (selected.length === 0) {
    alert("Chưa chọn ảnh nào.");
    return;
  }

  const blob = new Blob(
    [selected.join("\n\n")],
    { type: "text/plain" }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = "anh-can-xoa.txt";

  a.click();

  URL.revokeObjectURL(url);
}
function toggleSelectAll() {
  const checkboxes = document.querySelectorAll(
    '#result input[type="checkbox"]:not(:disabled)'
  );

  if (checkboxes.length === 0) {
    alert("Chưa có ảnh để chọn.");
    return;
  }

  const allChecked = [...checkboxes].every(
    checkbox => checkbox.checked
  );

  checkboxes.forEach(checkbox => {
    checkbox.checked = !allChecked;
  });

  selectAllBtn.textContent = allChecked
    ? "Chọn tất cả"
    : "Bỏ chọn tất cả";
updateSummary();
  
}

document.addEventListener("change", (e) => {
  if (e.target.classList.contains("delete-checkbox")) {
    updateSummary();
  }
});